import { supabaseAdmin } from './supabaseAdmin.js';

/**
 * Charge toutes les lignes nécessaires aux projections pour une classe.
 * @param {string} classeId
 */
export async function loadClasseData(classeId) {
  const db = supabaseAdmin();

  const { data: classe, error: ec } = await db
    .from('ar_classes')
    .select('id, nom, niveau, referent_plai_nom, ecole_id, annee_id, created_at, ar_ecoles(nom), ar_annees(libelle)')
    .eq('id', classeId)
    .single();
  if (ec) throw ec;

  const { data: eleves, error: ee } = await db
    .from('ar_eleves')
    .select('id, classe_id, prenom, initiale_nom, commentaire, created_at')
    .eq('classe_id', classeId)
    .order('prenom');
  if (ee) throw ee;
  const eleveIds = eleves.map((e) => e.id);

  const [cat, chap, au, sel, lib, ref] = await Promise.all([
    db.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type'),
    db.from('ar_chapitres').select('id, ordre, titre').order('ordre'),
    db.from('ar_amenagements_classe').select('amenagement_id, cree_le').eq('classe_id', classeId),
    eleveIds.length
      ? db.from('ar_selections').select('eleve_id, amenagement_id, cree_le').in('eleve_id', eleveIds)
      : Promise.resolve({ data: [] }),
    eleveIds.length
      ? db.from('ar_amenagements_libres').select('id, eleve_id, chapitre_id, texte, cree_le').in('eleve_id', eleveIds)
      : Promise.resolve({ data: [] }),
    db.from('ar_profils_acces').select('nom, role, niveaux').eq('ecole_id', classe.ecole_id).in('role', ['direction', 'referent_plai']),
  ]);
  for (const r of [cat, chap, au, sel, lib, ref]) if (r.error) throw r.error;

  return {
    classe,
    contexte: {
      classeNom: classe.nom,
      ecoleNom: classe.ar_ecoles?.nom ?? '',
      anneeLibelle: classe.ar_annees?.libelle ?? '',
    },
    eleves,
    amenagements: cat.data,
    chapitres: chap.data,
    auClasse: au.data,
    selectionsAR: sel.data,
    libres: lib.data,
    referents: (ref.data ?? []).map((r) => ({ nom: r.nom, fonction: r.role, niveaux: r.niveaux ?? null })),
  };
}

/** Charge les données de plusieurs classes en parallèle (regroupement "cours pratique"). */
export async function loadClassesData(classeIds) {
  return Promise.all(classeIds.map((id) => loadClasseData(id)));
}

/**
 * Vérifie que l'utilisateur peut lire/éditer ces classes : admin, ou profil
 * (referent_plai/direction/agent_plai) rattaché à l'école de CHAQUE classe
 * (legacy ecole_id ou table ar_profils_acces_ecoles). Appelé depuis du code
 * service role (contourne la RLS), donc vérifié ici à la main.
 * @returns {Promise<boolean>}
 */
export async function verifierAccesClasses(db, userId, classeIds) {
  const { data: profil } = await db.from('ar_profils_acces').select('role, ecole_id').eq('user_id', userId).maybeSingle();
  if (!profil) return false;
  if (profil.role === 'admin') return true;
  // Génération de lien enseignant réservée à referent_plai/direction (comme le
  // bouton "Copier le lien" côté écran, déjà masqué pour agent_plai).
  if (!['referent_plai', 'direction'].includes(profil.role)) return false;

  const { data: classes, error: ec } = await db.from('ar_classes').select('id, ecole_id').in('id', classeIds);
  if (ec || !classes || classes.length !== classeIds.length) return false;

  const { data: liens } = await db.from('ar_profils_acces_ecoles').select('ecole_id').eq('user_id', userId);
  const mesEcoles = new Set([profil.ecole_id, ...(liens ?? []).map((l) => l.ecole_id)].filter(Boolean));
  return classes.every((c) => mesEcoles.has(c.ecole_id));
}
