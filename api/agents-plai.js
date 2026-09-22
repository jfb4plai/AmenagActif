import { supabaseAdmin } from './_lib/supabaseAdmin.js';

/** Retourne l'utilisateur appelant s'il a un rôle d'édition d'école (admin/référent/direction), sinon null. */
async function exigerEditeur(req) {
  const jwt = (req.headers.authorization || '').replace('Bearer ', '');
  if (!jwt) return null;
  const db = supabaseAdmin();
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data.user) return null;
  const { data: acc } = await db
    .from('ar_profils_acces').select('role').eq('user_id', data.user.id).maybeSingle();
  if (!acc || !['admin', 'referent_plai', 'direction'].includes(acc.role)) return null;
  return data.user;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') { res.status(405).json({ error: 'Méthode non supportée.' }); return; }
    const moi = await exigerEditeur(req);
    if (!moi) { res.status(403).json({ error: 'Réservé aux référents PLAI, directions et administrateurs.' }); return; }
    const db = supabaseAdmin();
    const { data: rows, error } = await db.from('ar_profils_acces').select('user_id, nom').eq('role', 'agent_plai');
    if (error) throw error;
    const agents = await Promise.all(
      rows.map(async (r) => {
        const { data } = await db.auth.admin.getUserById(r.user_id);
        return { userId: r.user_id, email: data?.user?.email ?? '(compte inconnu)', nom: r.nom ?? '' };
      })
    );
    agents.sort((a, b) => (a.nom || a.email).localeCompare(b.nom || b.email));
    res.status(200).json({ agents });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
