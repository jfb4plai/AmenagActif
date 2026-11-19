import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/**
 * Fiches groupées enregistrées d'une école pour une année : [{ id, nom, classeIds }], triées par nom.
 * Une fiche groupée fusionne 2 à 10 classes ; elle se coche comme une classe pour composer un sommaire.
 */
export function useFichesGroupees(ecoleId, anneeId) {
  return useQuery({
    queryKey: ['fiches-groupees', ecoleId, anneeId],
    enabled: !!ecoleId && !!anneeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ar_fiches_groupees')
        .select('id, nom, ar_fiches_groupees_classes(classe_id)')
        .eq('ecole_id', ecoleId)
        .eq('annee_id', anneeId)
        .order('nom');
      if (error) throw error;
      return (data ?? []).map((f) => ({
        id: f.id,
        nom: f.nom,
        classeIds: (f.ar_fiches_groupees_classes ?? []).map((c) => c.classe_id),
      }));
    },
  });
}

/** Crée (id absent) ou modifie une fiche groupée, classes comprises, en une transaction (fonction SQL). */
export function useEnregistrerFicheGroupee(ecoleId, anneeId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id = null, nom, classeIds }) => {
      const { data, error } = await supabase.rpc('ar_fg_enregistrer', {
        p_id: id, p_ecole: ecoleId, p_annee: anneeId, p_nom: nom, p_classes: classeIds,
      });
      if (error) throw new Error(error.code === 'P0001' ? error.message : "Enregistrement impossible, réessayez.");
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fiches-groupees', ecoleId, anneeId] }),
  });
}

/** Supprime une fiche groupée : elle disparaît aussi des sommaires qui la contenaient ; les classes ne sont pas touchées. */
export function useSupprimerFicheGroupee(ecoleId, anneeId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('ar_fiches_groupees').delete().eq('id', id);
      if (error) throw new Error('Suppression impossible, réessayez.');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiches-groupees', ecoleId, anneeId] });
      qc.invalidateQueries({ queryKey: ['liens'] });
    },
  });
}
