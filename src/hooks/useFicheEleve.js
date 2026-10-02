import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { computeFicheEleve } from '../domain/projections/ficheEleve.js';

async function charger(eleveId) {
  const { data: eleve, error } = await supabase
    .from('ar_eleves')
    .select('id, prenom, initiale_nom, commentaire, statut, classe_id, ar_classes(nom, ar_ecoles(nom, implantation_nom))')
    .eq('id', eleveId).single();
  if (error) throw error;
  const [cat, chap, sel, lib, auc, modes] = await Promise.all([
    supabase.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type'),
    supabase.from('ar_chapitres').select('id, ordre, titre, est_dispositif').order('ordre'),
    supabase.from('ar_selections').select('eleve_id, amenagement_id').eq('eleve_id', eleveId),
    supabase.from('ar_amenagements_libres').select('id, eleve_id, chapitre_id, texte').eq('eleve_id', eleveId),
    supabase.from('ar_amenagements_classe').select('amenagement_id').eq('classe_id', eleve.classe_id),
    supabase.from('ar_classe_dispositifs').select('chapitre_id, pour_toute_la_classe').eq('classe_id', eleve.classe_id),
  ]);
  // Jamais de fiche partielle silencieuse : chaque lecture est contrôlée.
  if (cat.error) throw cat.error;
  if (chap.error) throw chap.error;
  if (sel.error) throw sel.error;
  if (lib.error) throw lib.error;
  if (auc.error) throw auc.error;
  if (modes.error) throw modes.error;
  return computeFicheEleve({
    eleve,
    classeNom: eleve.ar_classes?.nom ?? '',
    ecoleNom: eleve.ar_classes?.ar_ecoles?.implantation_nom || eleve.ar_classes?.ar_ecoles?.nom || '',
    amenagements: cat.data,
    chapitres: chap.data,
    selectionsAR: sel.data,
    libres: lib.data,
    auClasse: auc.data,
    modesDispositifs: modes.data,
  });
}

export function useFicheEleve(eleveId) {
  return useQuery({ queryKey: ['fiche-eleve', eleveId], enabled: !!eleveId, queryFn: () => charger(eleveId) });
}
