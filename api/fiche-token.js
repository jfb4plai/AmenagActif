import { verifyFicheToken, signFicheToken } from './_lib/jwt.js';
import { loadClasseData, loadClassesData, verifierAccesClasses } from './_lib/ficheData.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { computeFicheClasse } from '../src/domain/projections/ficheClasse.js';
import { fusionnerDonneesClasses } from '../src/domain/projections/fusionClasses.js';

const MAX_CLASSES = 10;
const MAX_NOM_GROUPE = 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const jwt = (req.headers.authorization || '').replace('Bearer ', '');
      const db = supabaseAdmin();
      const { data, error } = await db.auth.getUser(jwt);
      // Panne de l'auth (réseau, 5xx) : 500, pas 401 (un 401 ferait croire à une session expirée).
      if (error && (error.status === undefined || error.status === 0 || error.status >= 500)) {
        console.error('fiche-token : auth indisponible', error.name ?? '');
        res.status(500).json({ error: 'Service momentanément indisponible.' });
        return;
      }
      if (error || !data.user) { res.status(401).json({ error: 'non authentifie' }); return; }

      const { classeId, classeIds, nomGroupe } = req.body || {};
      if (classeIds !== undefined && !Array.isArray(classeIds)) { res.status(400).json({ error: 'classeIds doit être une liste.' }); return; }
      const idsGroupe = Array.isArray(classeIds) ? classeIds.filter(Boolean) : [];
      if (idsGroupe.length > MAX_CLASSES) { res.status(400).json({ error: `Au plus ${MAX_CLASSES} classes par fiche groupée.` }); return; }
      const cibles = idsGroupe.length > 0 ? idsGroupe : (classeId ? [classeId] : []);
      if (cibles.length === 0) { res.status(400).json({ error: 'classeId ou classeIds requis' }); return; }
      if (!cibles.every((id) => typeof id === 'string' && UUID_RE.test(id))) { res.status(400).json({ error: 'Identifiant de classe invalide.' }); return; }
      if (nomGroupe !== undefined && nomGroupe !== null && (typeof nomGroupe !== 'string' || nomGroupe.length > MAX_NOM_GROUPE)) {
        res.status(400).json({ error: `Nom de groupe : ${MAX_NOM_GROUPE} caractères au plus.` }); return;
      }

      const autorise = await verifierAccesClasses(db, data.user.id, cibles);
      if (!autorise) { res.status(403).json({ error: 'Accès refusé à une ou plusieurs de ces classes.' }); return; }

      const token = idsGroupe.length > 0
        ? await signFicheToken({ classeIds: idsGroupe, nomGroupe })
        : await signFicheToken({ classeId });
      const origin = req.headers.origin || `https://${req.headers.host || ''}`;
      res.status(200).json({ token, url: `${origin}/fiche/${token}` });
      return;
    }

    const token = req.query.token;
    if (!token) { res.status(400).json({ error: 'token requis' }); return; }
    const charge = await verifyFicheToken(token);

    let vm;
    if ('classeIds' in charge) {
      const parties = await loadClassesData(charge.classeIds);
      const fusion = fusionnerDonneesClasses(parties, charge.nomGroupe);
      vm = computeFicheClasse(fusion);
      vm.classesSources = fusion.classesSources;
    } else {
      const d = await loadClasseData(charge.classeId);
      vm = computeFicheClasse(d);
    }

    res.setHeader('Cache-Control', 'private, max-age=60');
    res.status(200).json({ vm });
  } catch (e) {
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
