import { supabaseAdmin } from './_lib/supabaseAdmin.js';

const ROLES = ['admin', 'referent_plai', 'direction'];
const ROLE_SCOPE = ['referent_plai', 'direction'];

/** Retourne l'utilisateur appelant s'il est administrateur, sinon null. */
async function exigerAdmin(req) {
  const jwt = (req.headers.authorization || '').replace('Bearer ', '');
  if (!jwt) return null;
  const db = supabaseAdmin();
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data.user) return null;
  const { data: acc } = await db
    .from('ar_profils_acces').select('role').eq('user_id', data.user.id).maybeSingle();
  if (!acc || acc.role !== 'admin') return null;
  return data.user;
}

export default async function handler(req, res) {
  try {
    const moi = await exigerAdmin(req);
    if (!moi) { res.status(403).json({ error: 'Réservé aux administrateurs.' }); return; }
    const db = supabaseAdmin();
    const origin = req.headers.origin || `https://${req.headers.host || ''}`;

    if (req.method === 'GET') {
      const { data: rows, error } = await db.from('ar_profils_acces').select('user_id, role, ecole_id');
      if (error) throw error;
      const membres = await Promise.all(
        rows.map(async (r) => {
          const { data } = await db.auth.admin.getUserById(r.user_id);
          return { userId: r.user_id, email: data?.user?.email ?? '(compte inconnu)', role: r.role, ecoleId: r.ecole_id };
        })
      );
      membres.sort((a, b) => a.email.localeCompare(b.email));
      res.status(200).json({ membres });
      return;
    }

    if (req.method === 'POST') {
      const { action, email, userId, role, ecoleId } = req.body || {};
      const scoped = ROLE_SCOPE.includes(role);
      const ecolePatch = () => (scoped ? ecoleId || null : null);

      if (action === 'invite') {
        if (!email || !ROLES.includes(role)) { res.status(400).json({ error: 'Email et rôle valides requis.' }); return; }
        if (scoped && !ecoleId) { res.status(400).json({ error: 'Ce rôle doit être rattaché à une école.' }); return; }
        const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/nouveau-mot-de-passe` });
        if (error) {
          if (/already|registered|exist/i.test(String(error.message))) {
            res.status(409).json({ error: "Ce compte existe déjà dans le projet Supabase. Ajoutez-le via SQL (ar_profils_acces) — voir README." });
            return;
          }
          throw error;
        }
        const { error: e2 } = await db.from('ar_profils_acces')
          .upsert({ user_id: data.user.id, role, ecole_id: ecolePatch() }, { onConflict: 'user_id' });
        if (e2) throw e2;
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'setRole') {
        if (!userId || !ROLES.includes(role)) { res.status(400).json({ error: 'userId et rôle valides requis.' }); return; }
        if (scoped && !ecoleId) { res.status(400).json({ error: 'Ce rôle doit être rattaché à une école.' }); return; }
        const { error } = await db.from('ar_profils_acces')
          .upsert({ user_id: userId, role, ecole_id: ecolePatch() }, { onConflict: 'user_id' });
        if (error) throw error;
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'revoke') {
        if (!userId) { res.status(400).json({ error: 'userId requis.' }); return; }
        if (userId === moi.id) { res.status(400).json({ error: 'Vous ne pouvez pas retirer votre propre accès.' }); return; }
        const { error } = await db.from('ar_profils_acces').delete().eq('user_id', userId);
        if (error) throw error;
        res.status(200).json({ ok: true });
        return;
      }

      res.status(400).json({ error: 'Action inconnue.' });
      return;
    }

    res.status(405).json({ error: 'Méthode non supportée.' });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
