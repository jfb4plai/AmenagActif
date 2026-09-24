import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { authentifier } from './_lib/authUtilisateur.js';
import { peutGererEcole, ecolesGerables, versLienPublic } from './_lib/liens.js';
import { revoquerLien } from './_lib/liensData.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_LIENS = 1000;
const COLONNES_PUBLIQUES = 'id, ecole_id, destinataire, nom_groupe, cree_par, cree_le, expire_le, revoque_le, derniere_ouverture, nb_ouvertures'; // jamais token_hash

/**
 * Gestion des liens enseignants (utilisateur connecté : admin, référent PLAI, direction ; jamais agent_plai).
 * GET  ?ecole_id=<uuid> (optionnel) : liens des écoles gérables, sans token_hash.
 * POST { action: 'revoke', lien_id } : révocation idempotente, la ligne n'est jamais supprimée.
 * Les erreurs renvoyées au client sont génériques ; le journal serveur ne contient aucune donnée personnelle.
 */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const db = supabaseAdmin();
    const auth = await authentifier(db, req, 'liens');
    if (!auth.user) { res.status(auth.statut).json({ error: auth.erreur }); return; }

    const { data: profil, error: eProfil } = await db.from('ar_profils_acces').select('role, ecole_id').eq('user_id', auth.user.id).maybeSingle();
    if (eProfil) throw eProfil;
    const { data: liaisons, error: eLia } = await db.from('ar_profils_acces_ecoles').select('ecole_id').eq('user_id', auth.user.id);
    if (eLia) throw eLia;
    const ecolesLiees = (liaisons ?? []).map((l) => l.ecole_id);

    if (req.method === 'GET') {
      const gerables = ecolesGerables(profil, ecolesLiees); // null = toutes (admin), [] = aucune
      const demandee = req.query?.ecole_id;
      if (demandee !== undefined && (typeof demandee !== 'string' || !UUID_RE.test(demandee))) { res.status(400).json({ error: 'ecole_id invalide.' }); return; }
      if (demandee && !peutGererEcole(profil, ecolesLiees, demandee)) { res.status(403).json({ error: 'Accès refusé.' }); return; }
      if (gerables !== null && gerables.length === 0) { res.status(403).json({ error: 'Accès refusé.' }); return; }

      let q = db.from('ar_liens').select(COLONNES_PUBLIQUES).order('cree_le', { ascending: false }).limit(LIMITE_LIENS);
      if (demandee) q = q.eq('ecole_id', demandee);
      else if (gerables !== null) q = q.in('ecole_id', gerables);
      const { data: rows, error } = await q;
      if (error) throw error;

      const ids = (rows ?? []).map((r) => r.id);
      const ecoleIds = gerables === null && !demandee ? null : (demandee ? [demandee] : gerables);
      const [{ data: liensClasses, error: eC }, { data: ecoles, error: eE }] = await Promise.all([
        ids.length ? db.from('ar_liens_classes').select('lien_id, ar_classes(nom)').in('lien_id', ids) : { data: [], error: null },
        ecoleIds === null ? db.from('ar_ecoles').select('id, nom, implantation, implantation_nom').order('nom') : db.from('ar_ecoles').select('id, nom, implantation, implantation_nom').in('id', ecoleIds).order('nom'),
      ]);
      if (eC) throw eC;
      if (eE) throw eE;
      const classesParLien = new Map();
      for (const lc of liensClasses ?? []) {
        const l = classesParLien.get(lc.lien_id) ?? [];
        if (lc.ar_classes?.nom) l.push(lc.ar_classes.nom);
        classesParLien.set(lc.lien_id, l);
      }
      // Seul l'e-mail du compte créateur est exposé (pas d'autre donnée du compte).
      const createurs = new Map();
      for (const uid of new Set((rows ?? []).map((r) => r.cree_par))) {
        const { data } = await db.auth.admin.getUserById(uid);
        createurs.set(uid, data?.user?.email ?? null);
      }
      const now = new Date();
      const liens = (rows ?? []).map((r) => versLienPublic(r, { classes: (classesParLien.get(r.id) ?? []).sort(), creePar: createurs.get(r.cree_par) ?? null, now }));
      res.status(200).json({ ecoles: ecoles ?? [], liens });
      return;
    }

    if (req.method === 'POST') {
      const { action, lien_id: lienId } = req.body || {};
      if (action !== 'revoke') { res.status(400).json({ error: 'Action inconnue.' }); return; }
      if (typeof lienId !== 'string' || !UUID_RE.test(lienId)) { res.status(400).json({ error: 'lien_id invalide.' }); return; }
      const { data: lien, error } = await db.from('ar_liens').select('id, ecole_id').eq('id', lienId).maybeSingle();
      if (error) throw error;
      if (!lien) { res.status(404).json({ error: 'Lien introuvable.' }); return; }
      if (!peutGererEcole(profil, ecolesLiees, lien.ecole_id)) { res.status(403).json({ error: 'Accès refusé.' }); return; }
      const resultat = await revoquerLien(db, lienId, auth.user.id);
      res.status(200).json({ ok: true, deja_revoque: resultat === 'deja' });
      return;
    }

    res.status(405).json({ error: 'Méthode non supportée.' });
  } catch (e) {
    console.error('liens :', e?.code ?? e?.name ?? 'erreur');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
}
