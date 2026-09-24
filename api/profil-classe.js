import { signProfilToken, verifyProfilToken, joursProfil } from './_lib/jwt.js';
import { loadClasseData, verifierAccesClasses } from './_lib/ficheData.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { authentifier } from './_lib/authUtilisateur.js';
import { formeSecretValide, plafonnerExpirationProfil } from './_lib/liens.js';
import { trouverLienParSecret, trouverLienParId, lienActif } from './_lib/liensData.js';
import { computeProfilClasse } from '../src/domain/projections/profilClasse.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Passerelle « profil de classe » (contrat plai.profil-classe v1).
 * POST, deux modes d'autorisation :
 *   (1) utilisateur connecté (admin, ou référent PLAI / direction rattaché à l'école de la classe) ;
 *   (2) secret de lien enseignant opaque dans le corps { lien, classeId } : hash, non révoqué, non expiré,
 *       et classeId DOIT figurer parmi les classes de ce lien. Un enseignant sans compte peut ainsi obtenir
 *       le profil de SES classes, jamais d'une autre.
 *   -> émet un jeton distinct du jeton de fiche (aud = 'profil', jti). Issu d'un lien, il porte lid (id du lien)
 *      et son expiration est plafonnée à celle du lien.
 * GET (Authorization: Bearer <jeton>) -> profil recalculé côté serveur. Si le jeton porte lid, le lien est relu en base
 *   à CHAQUE lecture : révoqué ou expiré => 401 (la révocation du lien coupe les jetons déjà émis).
 */
export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { classeId, lien: secretLien } = req.body || {};
      if (typeof classeId !== 'string' || !UUID_RE.test(classeId)) { res.status(400).json({ error: 'classeId (UUID) requis.' }); return; }
      const db = supabaseAdmin();
      res.setHeader('Cache-Control', 'private, no-store');

      if (secretLien !== undefined && secretLien !== null) {
        const lien = formeSecretValide(secretLien) ? await trouverLienParSecret(db, secretLien) : null;
        // Inconnu, révoqué, expiré, ou classe hors du lien : même refus, pas d'oracle.
        if (!lienActif(lien) || !lien.classeIds.includes(classeId)) { res.status(403).json({ error: "Ce lien n'est plus actif ou ne couvre pas cette classe." }); return; }
        const exp = plafonnerExpirationProfil(Date.now(), joursProfil(), lien.expire_le);
        const token = await signProfilToken({ classeId, lid: lien.id, expSecondes: exp });
        res.status(200).json({ token, expire_le: new Date(exp * 1000).toISOString().slice(0, 10) });
        return;
      }

      const auth = await authentifier(db, req, 'profil-classe');
      if (!auth.user) { res.status(auth.statut).json({ error: auth.erreur }); return; }
      // Même contrôle que la fiche enseignant, sans le contourner.
      const autorise = await verifierAccesClasses(db, auth.user.id, [classeId]);
      if (!autorise) { res.status(403).json({ error: 'Accès refusé à cette classe.' }); return; }

      const jours = joursProfil();
      const token = await signProfilToken({ classeId, joursValide: jours });
      const expireLe = new Date(Date.now() + jours * 86400000).toISOString().slice(0, 10);
      res.status(200).json({ token, expire_le: expireLe });
      return;
    }

    if (req.method === 'GET') {
      const jeton = (req.headers.authorization || '').replace(/^Bearer /, '');
      if (!jeton) { res.status(401).json({ error: 'jeton requis' }); return; }
      const { classeId, exp, lid } = await verifyProfilToken(jeton);
      res.setHeader('Cache-Control', 'private, no-store');
      if (lid) {
        const lien = await trouverLienParId(supabaseAdmin(), lid);
        if (!lienActif(lien) || !lien.classeIds.includes(classeId)) { res.status(401).json({ error: 'jeton invalide ou expiré' }); return; }
      }
      const donnees = await loadClasseData(classeId);
      const profil = computeProfilClasse(donnees, { expireAt: new Date(exp * 1000) });
      res.status(200).json(profil);
      return;
    }

    res.status(405).json({ error: 'Méthode non supportée.' });
  } catch (e) {
    // Signature/aud/exp invalides (erreurs jose) : 401. Toute autre erreur (base, configuration) : 500.
    const jeton = typeof e?.code === 'string' && (e.code.startsWith('ERR_JWT') || e.code.startsWith('ERR_JWS'));
    res.setHeader('Cache-Control', 'private, no-store');
    if (req.method === 'GET' && jeton) { res.status(401).json({ error: 'jeton invalide ou expiré' }); return; }
    if (req.method === 'GET' && e?.cause?.code === 'PGRST116') { res.status(404).json({ error: 'classe introuvable' }); return; }
    console.error('profil-classe :', e?.code ?? e?.name ?? 'erreur');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
}
