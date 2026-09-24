import { signProfilToken, verifyProfilToken, joursProfil } from './_lib/jwt.js';
import { loadClasseData, verifierAccesClasses } from './_lib/ficheData.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { computeProfilClasse } from '../src/domain/projections/profilClasse.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Passerelle « profil de classe » (contrat plai.profil-classe v1).
 * POST (utilisateur connecté : admin, ou référent PLAI / direction rattaché à l'école de la classe)
 *   -> émet un jeton distinct du jeton de fiche (aud = 'profil', jti, durée limitée).
 * GET (Authorization: Bearer <jeton>) -> profil recalculé côté serveur, jamais lu depuis le client.
 *
 * TODO (hors périmètre) : révocation par jti (table ar_liens). Tant qu'elle n'existe pas, un jeton
 * émis reste valable jusqu'à son expiration.
 */
export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const jwt = (req.headers.authorization || '').replace('Bearer ', '');
      const db = supabaseAdmin();
      const { data, error } = await db.auth.getUser(jwt);
      if (error && (error.status === undefined || error.status === 0 || error.status >= 500)) {
        console.error('profil-classe : auth indisponible', error.name ?? '');
        res.status(500).json({ error: 'Service momentanément indisponible.' });
        return;
      }
      if (error || !data?.user) { res.status(401).json({ error: 'non authentifie' }); return; }

      const { classeId } = req.body || {};
      if (typeof classeId !== 'string' || !UUID_RE.test(classeId)) { res.status(400).json({ error: 'classeId (UUID) requis.' }); return; }

      // Même contrôle que la fiche enseignant, sans le contourner.
      const autorise = await verifierAccesClasses(db, data.user.id, [classeId]);
      if (!autorise) { res.status(403).json({ error: 'Accès refusé à cette classe.' }); return; }

      const jours = joursProfil();
      const token = await signProfilToken({ classeId, joursValide: jours });
      const expireLe = new Date(Date.now() + jours * 86400000).toISOString().slice(0, 10);
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(200).json({ token, expire_le: expireLe });
      return;
    }

    if (req.method === 'GET') {
      const jeton = (req.headers.authorization || '').replace(/^Bearer /, '');
      if (!jeton) { res.status(401).json({ error: 'jeton requis' }); return; }
      const { classeId, exp } = await verifyProfilToken(jeton);
      const donnees = await loadClasseData(classeId);
      const profil = computeProfilClasse(donnees, { expireAt: new Date(exp * 1000) });
      res.setHeader('Cache-Control', 'private, no-store');
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
