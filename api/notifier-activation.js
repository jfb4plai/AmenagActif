import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { authentifier } from './_lib/authUtilisateur.js';
import { notifierActivation } from './_lib/activation.js';

/**
 * POST (utilisateur connecté, sans corps) : appelé par la page « nouveau mot de passe » après le succès du changement.
 * Prévient les administrateurs, une seule fois par compte. La réponse ne révèle rien (ok: true) : l'appelant
 * n'a pas à savoir si une notification a été envoyée.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') { res.status(405).json({ error: 'Méthode non autorisée.' }); return; }
  try {
    const db = supabaseAdmin();
    const auth = await authentifier(db, req, 'notifier-activation');
    if (!auth.user) { res.status(auth.statut).json({ error: auth.erreur }); return; }
    await notifierActivation(db, auth.user);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('notifier-activation :', e?.code ?? e?.name ?? 'erreur');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
}
