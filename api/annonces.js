import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { authentifier } from './_lib/authUtilisateur.js';
import { envoyerAnnonce, effectifs, ErreurAnnonce } from './_lib/annonces.js';

/**
 * Messages de l'administrateur aux utilisateurs (réservé aux administrateurs).
 * GET  : { annonces: 20 derniers envois réels, effectifs: comptes par rôle }
 * POST { action: 'test' | 'envoyer', sujet, corps, roles } :
 *   test    : exemplaire à tous les administrateurs, rien n'est journalisé ;
 *   envoyer : envoi réel aux rôles choisis, journalisé ; même message refusé s'il est parti il y a moins de 10 minutes.
 * Les erreurs renvoyées au client sont génériques ; le journal serveur ne contient aucune adresse.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const db = supabaseAdmin();
    const auth = await authentifier(db, req, 'annonces');
    if (!auth.user) { res.status(auth.statut).json({ error: auth.erreur }); return; }
    const { data: profil, error: eP } = await db.from('ar_profils_acces').select('role').eq('user_id', auth.user.id).maybeSingle();
    if (eP) throw eP;
    if (profil?.role !== 'admin') { res.status(403).json({ error: 'Réservé aux administrateurs.' }); return; }

    if (req.method === 'GET') {
      const { data, error } = await db.from('ar_annonces')
        .select('id, sujet, roles, nb_destinataires, nb_echecs, envoye_le').order('envoye_le', { ascending: false }).limit(20);
      if (error) throw error;
      res.status(200).json({ annonces: data ?? [], effectifs: await effectifs(db) });
      return;
    }
    if (req.method === 'POST') {
      const { action, sujet, corps, roles } = req.body || {};
      if (action !== 'test' && action !== 'envoyer') { res.status(400).json({ error: 'Action inconnue.' }); return; }
      const r = await envoyerAnnonce(db, { mode: action, sujet, corps, roles, userId: auth.user.id });
      res.status(200).json({ ok: true, ...r });
      return;
    }
    res.status(405).json({ error: 'Méthode non supportée.' });
  } catch (e) {
    if (e instanceof ErreurAnnonce) { res.status(e.statut).json({ error: e.message }); return; }
    console.error('annonces :', e?.code ?? e?.name ?? 'erreur');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
}
