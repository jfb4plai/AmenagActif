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
