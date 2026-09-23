import { verifyFicheToken, signFicheToken } from './_lib/jwt.js';
import { loadClasseData, loadClassesData, verifierAccesClasses } from './_lib/ficheData.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { computeFicheClasse } from '../src/domain/projections/ficheClasse.js';
import { fusionnerDonneesClasses } from '../src/domain/projections/fusionClasses.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const jwt = (req.headers.authorization || '').replace('Bearer ', '');
      const db = supabaseAdmin();
      const { data, error } = await db.auth.getUser(jwt);
      if (error || !data.user) { res.status(401).json({ error: 'non authentifie' }); return; }

      const { classeId, classeIds, nomGroupe } = req.body || {};
      const idsGroupe = Array.isArray(classeIds) ? classeIds.filter(Boolean) : [];
      const cibles = idsGroupe.length > 0 ? idsGroupe : (classeId ? [classeId] : []);
      if (cibles.length === 0) { res.status(400).json({ error: 'classeId ou classeIds requis' }); return; }

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
    res.status(401).json({ error: 'lien invalide ou expiré' });
  }
}
