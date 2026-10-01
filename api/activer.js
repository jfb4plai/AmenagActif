import { verifyInvitationToken } from './_lib/jwt.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

const APP_URL = 'https://amenagactif.jfb4plai.com';

/**
 * Activation de compte depuis le courriel d'invitation.
 * POST { t } : jeton d'invitation (7 jours) -> lien Supabase neuf (valable 24 h, consommé aussitôt par le clic).
 * Déclenché par un clic dans l'app (pas un GET) : les antivirus de messagerie qui préchargent les liens
 * ne consomment donc pas le lien Supabase. Réponses d'erreur génériques.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'Méthode non autorisée.' }); return; }
  const { t } = req.body || {};
  if (typeof t !== 'string' || !t) { res.status(400).json({ error: 'Lien invalide.' }); return; }
  let email;
  try {
    ({ email } = await verifyInvitationToken(t));
  } catch {
    res.status(410).json({ error: 'Ce lien a expiré ou est invalide.' });
    return;
  }
  try {
    const db = supabaseAdmin();
    // Le compte existe déjà (créé à l'invitation) : recovery = lien de définition de mot de passe.
    const { data, error } = await db.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${APP_URL}/nouveau-mot-de-passe` },
    });
    if (error || !data?.properties?.action_link) {
      console.error('activer :', error?.code ?? error?.name ?? 'erreur');
      res.status(410).json({ error: 'Ce lien a expiré ou est invalide.' });
      return;
    }
    res.status(200).json({ url: data.properties.action_link });
  } catch {
    console.error('activer : exception');
    res.status(500).json({ error: 'Erreur serveur, réessayez.' });
  }
}
