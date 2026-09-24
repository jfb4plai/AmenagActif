import { supabaseAdmin } from './_lib/supabaseAdmin.js';

/** Catalogue public (aucune donnée élève) : liste de référence des AU/AR actifs,
 * utilisée par la page /catalogue-amenagements — accessible sans connexion. */
export default async function handler(req, res) {
  try {
    const db = supabaseAdmin();
    const [{ data: chapitres, error: e1 }, { data: amenagements, error: e2 }] = await Promise.all([
      db.from('ar_chapitres').select('id, ordre, titre').order('ordre'),
      db.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type').eq('actif', true).order('ordre'),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json({ chapitres, amenagements });
  } catch (e) {
    console.error('catalogue :', e?.code ?? e?.name ?? 'erreur');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
}
