import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { computeFicheEleve } from '../domain/projections/ficheEleve.js';

async function charger(eleveId) {
  const { data: eleve, error } = await supabase
    .from('ar_eleves').select('id, prenom, initiale_nom, commentaire, classe_id, ar_classes(nom)').eq('id', eleveId).single();
  if (error) throw error;
  const [cat, chap, sel, lib] = await Promise.all([
    supabase.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type'),
    supabase.from('ar_chapitres').select('id, ordre, titre').order('ordre'),
    supabase.from('ar_selections').select('eleve_id, amenagement_id').eq('eleve_id', eleveId),
    supabase.from('ar_amenagements_libres').select('id, eleve_id, chapitre_id, texte').eq('eleve_id', eleveId),
  ]);
  return computeFicheEleve({
    eleve,
    classeNom: eleve.ar_classes?.nom ?? '',
    amenagements: cat.data,
    chapitres: chap.data,
    selectionsAR: sel.data,
    libres: lib.data,
  });
}

export function useFicheEleve(eleveId) {
  return useQuery({ queryKey: ['fiche-eleve', eleveId], enabled: !!eleveId, queryFn: () => charger(eleveId) });
}
