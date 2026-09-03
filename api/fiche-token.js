import { verifyFicheToken, signFicheToken } from './_lib/jwt.js';
import { loadClasseData } from './_lib/ficheData.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { computeFicheClasse } from '../src/domain/projections/ficheClasse.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const jwt = (req.headers.authorization || '').replace('Bearer ', '');
      const { data, error } = await supabaseAdmin().auth.getUser(jwt);
      if (error || !data.user) { res.status(401).json({ error: 'non authentifie' }); return; }
      const { classeId } = req.body || {};
      if (!classeId) { res.status(400).json({ error: 'classeId requis' }); return; }
      const token = await signFicheToken({ classeId });
      const origin = req.headers.origin || `https://${req.headers.host || ''}`;
      res.status(200).json({ token, url: `${origin}/fiche/${token}` });
      return;
    }

    const token = req.query.token;
    if (!token) { res.status(400).json({ error: 'token requis' }); return; }
    const { classeId } = await verifyFicheToken(token);
    const d = await loadClasseData(classeId);
    const vm = computeFicheClasse(d);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.status(200).json({ vm });
  } catch (e) {
    res.status(401).json({ error: 'lien invalide ou expiré' });
  }
}
