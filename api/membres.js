import { supabaseAdmin } from './_lib/supabaseAdmin.js';

/** Retourne l'utilisateur appelant s'il est référent PLAI (rôle plai sans école), sinon null. */
async function exigerPlai(req) {
  const jwt = (req.headers.authorization || '').replace('Bearer ', '');
  if (!jwt) return null;
  const db = supabaseAdmin();
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data.user) return null;
  const { data: acc } = await db
    .from('ar_profils_acces').select('role, ecole_id').eq('user_id', data.user.id).maybeSingle();
  if (!acc || acc.role !== 'plai' || acc.ecole_id) return null;
  return data.user;
}

export default async function handler(req, res) {
  try {
    const moi = await exigerPlai(req);
    if (!moi) { res.status(403).json({ error: 'Réservé aux référents PLAI.' }); return; }
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
      const ecolePatch = (r) => (r === 'direction' ? ecoleId || null : null);

      if (action === 'invite') {
        if (!email || !['plai', 'direction'].includes(role)) { res.status(400).json({ error: 'Email et rôle valides requis.' }); return; }
        if (role === 'direction' && !ecoleId) { res.status(400).json({ error: 'Une direction doit être rattachée à une école.' }); return; }
        const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/nouveau-mot-de-passe` });
        if (error) {
          if (/already|registered|exist/i.test(String(error.message))) {
            res.status(409).json({ error: "Ce compte existe déjà dans le projet Supabase. Ajoutez-le via SQL (ar_profils_acces) — voir README." });
            return;
          }
          throw error;
        }
        const { error: e2 } = await db.from('ar_profils_acces')
          .upsert({ user_id: data.user.id, role, ecole_id: ecolePatch(role) }, { onConflict: 'user_id' });
        if (e2) throw e2;
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'setRole') {
        if (!userId || !['plai', 'direction'].includes(role)) { res.status(400).json({ error: 'userId et rôle valides requis.' }); return; }
        if (role === 'direction' && !ecoleId) { res.status(400).json({ error: 'Une direction doit être rattachée à une école.' }); return; }
        const { error } = await db.from('ar_profils_acces')
          .upsert({ user_id: userId, role, ecole_id: ecolePatch(role) }, { onConflict: 'user_id' });
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
