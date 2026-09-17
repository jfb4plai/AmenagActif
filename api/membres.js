import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { envoyerEmail } from './_lib/email.js';

const ROLES = ['admin', 'referent_plai', 'direction', 'agent_plai'];
const ROLE_SCOPE = ['referent_plai', 'direction', 'agent_plai'];
const LABEL_ROLE = { admin: 'Administrateur', referent_plai: 'Référent PLAI', direction: 'Direction', agent_plai: 'Agent accompagnant' };

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
      const { data: rows, error } = await db.from('ar_profils_acces').select('user_id, nom, role, ecole_id, niveaux');
      if (error) throw error;
      const membres = await Promise.all(
        rows.map(async (r) => {
          const { data } = await db.auth.admin.getUserById(r.user_id);
          return { userId: r.user_id, email: data?.user?.email ?? '(compte inconnu)', nom: r.nom ?? '', role: r.role, ecoleId: r.ecole_id, niveaux: r.niveaux ?? [] };
        })
      );
      membres.sort((a, b) => a.email.localeCompare(b.email));
      res.status(200).json({ membres });
      return;
    }

    if (req.method === 'POST') {
      const { action, email, userId, nom, role, ecoleId, niveaux } = req.body || {};
      const scoped = ROLE_SCOPE.includes(role);
      const ecolePour = () => (scoped ? ecoleId || null : null);

      if (action === 'invite') {
        if (!email || !ROLES.includes(role)) { res.status(400).json({ error: 'Email et rôle valides requis.' }); return; }
        if (scoped && !ecoleId) { res.status(400).json({ error: 'Ce rôle doit être rattaché à une école.' }); return; }
        const { data, error } = await db.auth.admin.generateLink({
          type: 'invite',
          email,
          options: { redirectTo: `${origin}/nouveau-mot-de-passe` },
        });
        if (error) {
          if (/already|registered|exist/i.test(String(error.message))) {
            res.status(409).json({ error: "Ce compte existe déjà dans le projet Supabase. Ajoutez-le via SQL (ar_profils_acces) — voir README." });
            return;
          }
          throw error;
        }
        const { error: e2 } = await db.from('ar_profils_acces')
          .upsert({ user_id: data.user.id, nom: (nom || '').trim(), role, ecole_id: ecolePour() }, { onConflict: 'user_id' });
        if (e2) throw e2;

        const lien = data.properties.action_link;
        const roleLabel = LABEL_ROLE[role] ?? role;
        try {
          await envoyerEmail({
            to: email,
            subject: 'Invitation à AménagActif',
            html: `<p>Bonjour,</p><p>Vous avez été invité·e à rejoindre <strong>AménagActif</strong> par le Pôle Territorial de la Ville de Liège (PLAI), avec le rôle <strong>${roleLabel}</strong>.</p><p><a href="${lien}">Cliquez ici pour définir votre mot de passe et activer votre compte</a>.</p><p>Ce lien est personnel, ne le transférez pas.</p>`,
          });
        } catch (e3) {
          res.status(502).json({ error: `Compte créé, mais l'envoi de l'email d'invitation a échoué (${e3.message}). Réessayez l'invitation.` });
          return;
        }
        try {
          await envoyerEmail({
            to: moi.email,
            subject: `AménagActif — invitation envoyée à ${email}`,
            html: `<p>Confirmation : vous venez d'inviter <strong>${email}</strong> avec le rôle <strong>${roleLabel}</strong>${scoped ? ' (école rattachée)' : ''}, le ${new Date().toLocaleString('fr-BE')}.</p>`,
          });
        } catch (e4) {
          console.error("Notification admin (invitation) échouée :", e4);
        }
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'setProfil') {
        if (!userId) { res.status(400).json({ error: 'userId requis.' }); return; }
        const patch = {};
        if (role !== undefined) {
          if (!ROLES.includes(role)) { res.status(400).json({ error: 'Rôle invalide.' }); return; }
          patch.role = role;
          patch.ecole_id = ROLE_SCOPE.includes(role) ? (ecoleId || null) : null;
          if (ROLE_SCOPE.includes(role) && !patch.ecole_id) { res.status(400).json({ error: 'Ce rôle doit être rattaché à une école.' }); return; }
        } else if (ecoleId !== undefined) {
          patch.ecole_id = ecoleId || null;
        }
        if (nom !== undefined) patch.nom = (nom || '').trim();
        if (niveaux !== undefined) patch.niveaux = Array.isArray(niveaux) && niveaux.length ? niveaux : null;
        if (Object.keys(patch).length === 0) { res.status(400).json({ error: 'Rien à modifier.' }); return; }
        const { error } = await db.from('ar_profils_acces').update(patch).eq('user_id', userId);
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
