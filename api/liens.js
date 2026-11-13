import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { authentifier } from './_lib/authUtilisateur.js';
import { peutGererEcole, ecolesGerables, versLienPublic, statutLien, MAX_IDS_PAR_REQUETE } from './_lib/liens.js';
import { revoquerLien, purgerLiensExpires, definirClasses, ErreurLien } from './_lib/liensData.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_LIENS = 1000;
const COLONNES_PUBLIQUES = 'id, ecole_id, annee_id, mode, numero, destinataire, nom_groupe, cree_par, cree_le, expire_le, revoque_le, derniere_ouverture, nb_ouvertures'; // jamais token_hash

/**
 * Gestion des liens enseignants (utilisateur connecté : admin, référent PLAI, direction ; jamais agent_plai).
 * GET  ?ecole_id=<uuid> (optionnel) : supprime d'abord les liens expirés (purge après le 31 août), puis liste les
 *      liens des écoles gérables, sans token_hash. La purge est globale (toutes écoles) mais n'est lancée qu'après
 *      les contrôles d'accès.
 * POST { action: 'revoke', lien_id } : révocation idempotente, la ligne n'est pas supprimée (elle l'est à l'expiration).
 * POST { action: 'definir_classes', lien_id, classe_ids } : remplace les classes d'un sommaire actif (fonction SQL atomique).
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

      await purgerLiensExpires(db);
      let q = db.from('ar_liens').select(COLONNES_PUBLIQUES).order('cree_le', { ascending: false }).limit(LIMITE_LIENS);
      if (demandee) q = q.eq('ecole_id', demandee);
      else if (gerables !== null) q = q.in('ecole_id', gerables);
      const { data: rows, error } = await q;
      if (error) throw error;

      const ids = (rows ?? []).map((r) => r.id);
      const ecoleIds = gerables === null && !demandee ? null : (demandee ? [demandee] : gerables);
      const [{ data: liensClasses, error: eC }, { data: ecoles, error: eE }] = await Promise.all([
        ids.length ? db.from('ar_liens_classes').select('lien_id, classe_id, ar_classes(nom)').in('lien_id', ids) : { data: [], error: null },
        ecoleIds === null ? db.from('ar_ecoles').select('id, nom, implantation, implantation_nom').order('nom') : db.from('ar_ecoles').select('id, nom, implantation, implantation_nom').in('id', ecoleIds).order('nom'),
      ]);
      if (eC) throw eC;
      if (eE) throw eE;
      const classesParLien = new Map();
      const idsParLien = new Map();
      for (const lc of liensClasses ?? []) {
        const l = classesParLien.get(lc.lien_id) ?? [];
        if (lc.ar_classes?.nom) l.push(lc.ar_classes.nom);
        classesParLien.set(lc.lien_id, l);
        const i = idsParLien.get(lc.lien_id) ?? [];
        if (lc.classe_id) i.push(lc.classe_id);
        idsParLien.set(lc.lien_id, i);
      }
      // Seul l'e-mail du compte créateur est exposé (pas d'autre donnée du compte).
      const createurs = new Map();
      for (const uid of new Set((rows ?? []).map((r) => r.cree_par))) {
        const { data } = await db.auth.admin.getUserById(uid);
        createurs.set(uid, data?.user?.email ?? null);
      }
      const now = new Date();
      const liens = (rows ?? []).map((r) => versLienPublic(r, { classes: (classesParLien.get(r.id) ?? []).sort(), classeIds: idsParLien.get(r.id) ?? [], creePar: createurs.get(r.cree_par) ?? null, now }));
      res.status(200).json({ ecoles: ecoles ?? [], liens });
      return;
    }

    if (req.method === 'POST') {
      const { action, lien_id: lienId } = req.body || {};
      if (action === 'definir_classes') { await definirClassesAction(db, req, res, profil, ecolesLiees); return; }
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
    if (e instanceof ErreurLien) { res.status(e.statut).json({ error: e.message }); return; }
    console.error('liens :', e?.code ?? e?.name ?? 'erreur');
    res.status(500).json({ error: 'Erreur serveur.' });
  }
}

/** Remplace les classes d'un sommaire. Les contrôles JS précèdent la fonction SQL (le plafond n'y est pas appliqué). */
async function definirClassesAction(db, req, res, profil, ecolesLiees) {
  const { lien_id: lienId, classe_ids: brut } = req.body || {};
  if (typeof lienId !== 'string' || !UUID_RE.test(lienId)) { res.status(400).json({ error: 'lien_id invalide.' }); return; }
  if (!Array.isArray(brut) || brut.some((c) => typeof c !== 'string' || !UUID_RE.test(c))) { res.status(400).json({ error: 'classe_ids invalide.' }); return; }
  const ids = [...new Set(brut)];
  if (ids.length === 0 || ids.length > MAX_IDS_PAR_REQUETE) { res.status(400).json({ error: `Un sommaire regroupe de 1 à ${MAX_IDS_PAR_REQUETE} classes.` }); return; }

  const { data: lien, error } = await db.from('ar_liens').select('id, ecole_id, annee_id, mode, expire_le, revoque_le').eq('id', lienId).maybeSingle();
  if (error) throw error;
  if (!lien) { res.status(404).json({ error: 'Lien introuvable.' }); return; }
  if (!peutGererEcole(profil, ecolesLiees, lien.ecole_id)) { res.status(403).json({ error: 'Accès refusé.' }); return; }
  if (lien.mode !== 'sommaire') { res.status(400).json({ error: 'Seul un sommaire peut être modifié.' }); return; }
  if (statutLien(lien) !== 'actif') { res.status(400).json({ error: "Ce lien n'est plus actif." }); return; }

  const { data: classes, error: eCl } = await db.from('ar_classes').select('id, ecole_id, annee_id').in('id', ids);
  if (eCl) throw eCl;
  if (!classes || classes.length !== ids.length || classes.some((c) => c.ecole_id !== lien.ecole_id || c.annee_id !== lien.annee_id)) {
    res.status(400).json({ error: "Toutes les classes doivent appartenir à l'école et à l'année scolaire du lien." });
    return;
  }
  await definirClasses(db, lienId, ids);
  res.status(200).json({ ok: true, nb: ids.length });
}
