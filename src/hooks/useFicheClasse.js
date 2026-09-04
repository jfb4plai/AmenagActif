import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { computeFicheClasse } from '../domain/projections/ficheClasse.js';

async function chargerClasse(classeId) {
  const { data: classe, error } = await supabase
    .from('ar_classes')
    .select('id, nom, ecole_id, annee_id, created_at, ar_ecoles(nom), ar_annees(libelle)')
    .eq('id', classeId).single();
  if (error) throw error;

  const { data: eleves } = await supabase
    .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, referent_plai_nom, created_at').eq('classe_id', classeId).order('prenom');
  const eleveIds = eleves.map((e) => e.id);

  const [cat, chap, au, sel, lib, ref] = await Promise.all([
    supabase.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type'),
    supabase.from('ar_chapitres').select('id, ordre, titre').order('ordre'),
    supabase.from('ar_amenagements_classe').select('amenagement_id, cree_le').eq('classe_id', classeId),
    eleveIds.length ? supabase.from('ar_selections').select('eleve_id, amenagement_id, cree_le').in('eleve_id', eleveIds) : { data: [] },
    eleveIds.length ? supabase.from('ar_amenagements_libres').select('id, eleve_id, chapitre_id, texte, cree_le').in('eleve_id', eleveIds) : { data: [] },
    supabase.from('ar_referents_ecole').select('nom, fonction').eq('ecole_id', classe.ecole_id).eq('annee_id', classe.annee_id),
  ]);

  return computeFicheClasse({
    classe,
    contexte: { classeNom: classe.nom, ecoleNom: classe.ar_ecoles?.nom ?? '', anneeLibelle: classe.ar_annees?.libelle ?? '' },
    eleves,
    amenagements: cat.data,
    chapitres: chap.data,
    auClasse: au.data,
    selectionsAR: sel.data,
    libres: lib.data,
    referents: ref.data,
  });
}

export function useFicheClasse(classeId) {
  return useQuery({ queryKey: ['fiche-classe', classeId], enabled: !!classeId, queryFn: () => chargerClasse(classeId) });
}
