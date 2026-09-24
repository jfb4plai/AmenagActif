import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { envoyerEmail } from './_lib/email.js';

const ROLES = ['admin', 'referent_plai', 'direction', 'agent_plai'];
const ROLE_SCOPE = ['referent_plai', 'direction', 'agent_plai'];
const ROLE_SCOPE_MULTI = ['referent_plai', 'direction', 'agent_plai', 'admin']; // rôles pouvant être rattachés à PLUSIEURS écoles (admin : identification "Mon école" seulement, aucun droit en plus)
const LABEL_ROLE = { admin: 'Administrateur', referent_plai: 'Référent PLAI', direction: 'Direction', agent_plai: 'Agent accompagnant' };
const APP_URL = 'https://amenagactif.jfb4plai.com';

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

    if (req.method === 'GET') {
      const [{ data: rows, error }, { data: liens, error: eLiens }] = await Promise.all([
        db.from('ar_profils_acces').select('user_id, nom, role, ecole_id, niveaux'),
        db.from('ar_profils_acces_ecoles').select('user_id, ecole_id'),
      ]);
      if (error) throw error;
      if (eLiens) throw eLiens;
      const membres = await Promise.all(
        rows.map(async (r) => {
          const { data } = await db.auth.admin.getUserById(r.user_id);
          const ecoleIds = liens.filter((l) => l.user_id === r.user_id).map((l) => l.ecole_id);
          return { userId: r.user_id, email: data?.user?.email ?? '(compte inconnu)', nom: r.nom ?? '', role: r.role, ecoleId: r.ecole_id, ecoleIds, niveaux: r.niveaux ?? [] };
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
          options: { redirectTo: `${APP_URL}/nouveau-mot-de-passe` },
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

        if (ROLE_SCOPE_MULTI.includes(role) && ecoleId) {
          const { error: e2b } = await db.from('ar_profils_acces_ecoles').insert({ user_id: data.user.id, ecole_id: ecoleId });
          if (e2b && e2b.code !== '23505') throw e2b;
        }

        const lien = data.properties.action_link;
        const roleLabel = LABEL_ROLE[role] ?? role;
        try {
          await envoyerEmail({
            to: email,
            subject: 'Invitation à AménagActif',
            html: `<p>Bonjour,</p><p>Vous avez été invité·e à rejoindre <strong>AménagActif</strong> par le Pôle Territorial de la Ville de Liège (PLAI), avec le rôle <strong>${roleLabel}</strong>.</p><p><a href="${lien}">Cliquez ici pour définir votre mot de passe et activer votre compte</a>.</p><p><strong>Ce lien n'est valable que 24 heures.</strong> Passé ce délai, la page de définition du mot de passe vous permettra d'en redemander un directement avec votre adresse e-mail. Ce lien est personnel, ne le transférez pas.</p>`,
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

      if (action === 'addEcole') {
        if (!userId || !ecoleId) { res.status(400).json({ error: 'userId et ecoleId requis.' }); return; }
        const { data: cible } = await db.from('ar_profils_acces').select('role').eq('user_id', userId).maybeSingle();
        if (!cible || !ROLE_SCOPE_MULTI.includes(cible.role)) { res.status(400).json({ error: 'Ce rôle ne peut pas être rattaché à plusieurs écoles.' }); return; }
        const { error } = await db.from('ar_profils_acces_ecoles').insert({ user_id: userId, ecole_id: ecoleId });
        if (error && error.code !== '23505') throw error;
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'removeEcole') {
        if (!userId || !ecoleId) { res.status(400).json({ error: 'userId et ecoleId requis.' }); return; }
        const { error } = await db.from('ar_profils_acces_ecoles').delete().eq('user_id', userId).eq('ecole_id', ecoleId);
        if (error) throw error;
        res.status(200).json({ ok: true });
        return;
      }

      if (action === 'revoke') {
        if (!userId) { res.status(400).json({ error: 'userId requis.' }); return; }
        if (userId === moi.id) { res.status(400).json({ error: 'Vous ne pouvez pas retirer votre propre accès.' }); return; }
        // Écoles d'abord (défense en profondeur : la FK ar_pae_profil_fk cascade aussi), puis le profil.
        const { error: eEcoles } = await db.from('ar_profils_acces_ecoles').delete().eq('user_id', userId);
        if (eEcoles) throw eEcoles;
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
