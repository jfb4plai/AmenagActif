import { verifyFicheToken } from './_lib/jwt.js';
import { authentifier } from './_lib/authUtilisateur.js';
import { genererSecret, formeSecretValide, estFormeJwt, MAX_CLASSES_PAR_LIEN, MAX_DESTINATAIRE, MAX_NOM_GROUPE, MESSAGE_LIEN_INACTIF } from './_lib/liens.js';
import { creerLien, trouverLienParSecret, lienActif, compterOuverture, ErreurLien } from './_lib/liensData.js';
import { loadClasseData, loadClassesData, verifierAccesClasses } from './_lib/ficheData.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { computeFicheClasse } from '../src/domain/projections/ficheClasse.js';
import { fusionnerDonneesClasses } from '../src/domain/projections/fusionClasses.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const db = supabaseAdmin();
      const auth = await authentifier(db, req, 'fiche-token');
      if (!auth.user) { res.status(auth.statut).json({ error: auth.erreur }); return; }

      const { classeId, classeIds, nomGroupe, destinataire: destinataireBrut } = req.body || {};
      if (classeIds !== undefined && !Array.isArray(classeIds)) { res.status(400).json({ error: 'classeIds doit être une liste.' }); return; }
      const idsGroupe = Array.isArray(classeIds) ? classeIds.filter(Boolean) : [];
      if (idsGroupe.length > MAX_CLASSES_PAR_LIEN) { res.status(400).json({ error: `Au plus ${MAX_CLASSES_PAR_LIEN} classes par fiche groupée.` }); return; }
      const cibles = idsGroupe.length > 0 ? idsGroupe : (classeId ? [classeId] : []);
      if (cibles.length === 0) { res.status(400).json({ error: 'classeId ou classeIds requis' }); return; }
      if (!cibles.every((id) => typeof id === 'string' && UUID_RE.test(id))) { res.status(400).json({ error: 'Identifiant de classe invalide.' }); return; }
      if (nomGroupe !== undefined && nomGroupe !== null && (typeof nomGroupe !== 'string' || nomGroupe.length > MAX_NOM_GROUPE)) {
        res.status(400).json({ error: `Nom de groupe : ${MAX_NOM_GROUPE} caractères au plus.` }); return;
      }

      const destinataire = typeof destinataireBrut === 'string' ? destinataireBrut.trim() : '';
      if (destinataire.length < 1 || destinataire.length > MAX_DESTINATAIRE) {
        res.status(400).json({ error: `Destinataire requis (1 à ${MAX_DESTINATAIRE} caractères).` }); return;
      }

      const autorise = await verifierAccesClasses(db, auth.user.id, cibles);
      if (!autorise) { res.status(403).json({ error: 'Accès refusé à une ou plusieurs de ces classes.' }); return; }

      // Lien opaque : seul le hash est stocké ; le secret n'est renvoyé qu'ici, une seule fois.
      const secret = genererSecret();
      const { expire_le } = await creerLien(db, { userId: auth.user.id, classeIds: cibles, destinataire, nomGroupe: idsGroupe.length > 0 ? nomGroupe : null, secret });
      const origin = req.headers.origin || `https://${req.headers.host || ''}`;
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(200).json({ token: secret, url: `${origin}/fiche/${secret}`, expire_le });
      return;
    }

    const token = req.query.token;
    if (!token || typeof token !== 'string') { res.status(400).json({ error: 'token requis' }); return; }

    let opaque = false;
    let cible; // { classeId } | { classeIds, nomGroupe }
    if (estFormeJwt(token)) {
      // Chemin de repli : anciens liens JWT (120 jours, sans révocation), valides jusqu'à leur échéance.
      cible = await verifyFicheToken(token);
    } else {
      // Lien opaque. Forme inconnue, inexistant, révoqué, expiré : MÊME réponse (pas d'oracle).
      const lien = formeSecretValide(token) ? await trouverLienParSecret(supabaseAdmin(), token) : null;
      if (!lienActif(lien)) { res.status(410).json({ error: MESSAGE_LIEN_INACTIF }); return; }
      opaque = true;
      await compterOuverture(supabaseAdmin(), lien.id);
      cible = lien.classeIds.length > 1 ? { classeIds: lien.classeIds, nomGroupe: lien.nom_groupe } : { classeId: lien.classeIds[0] };
    }

    let vm;
    if ('classeIds' in cible) {
      const parties = await loadClassesData(cible.classeIds);
      const fusion = fusionnerDonneesClasses(parties, cible.nomGroupe);
      vm = computeFicheClasse(fusion);
      vm.classesSources = fusion.classesSources;
    } else {
      const d = await loadClasseData(cible.classeId);
      vm = computeFicheClasse(d);
    }

    // Lien opaque : pas de cache navigateur (la révocation doit être immédiate).
    res.setHeader('Cache-Control', opaque ? 'private, no-store' : 'private, max-age=60');
    res.status(200).json({ vm });
  } catch (e) {
    if (e instanceof ErreurLien) { res.status(e.statut).json({ error: e.message }); return; }
    // Jeton illisible/expiré (erreurs jose) : 401. Toute autre erreur (base, configuration) : 500.
    const jeton = typeof e?.code === 'string' && (e.code.startsWith('ERR_JWT') || e.code.startsWith('ERR_JWS'));
    if (req.method === 'POST' || !jeton) {
      console.error('fiche-token :', e?.code ?? e?.name ?? 'erreur');
      res.status(500).json({ error: 'Erreur serveur.' });
      return;
    }
    res.status(401).json({ error: 'lien invalide ou expiré' });
  }
}
