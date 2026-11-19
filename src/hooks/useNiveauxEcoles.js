import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/** Valeur `niveau` de chaque classe des écoles données pour l'année donnée (null si non renseigné). */
export function useNiveauxEcoles(ecoleIds, anneeId) {
  const ids = [...(ecoleIds ?? [])].sort();
  return useQuery({
    queryKey: ['niveaux-ecoles', ids, anneeId],
    enabled: ids.length > 0 && !!anneeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('ar_classes').select('niveau').in('ecole_id', ids).eq('annee_id', anneeId);
      if (error) throw error;
      return (data ?? []).map((c) => c.niveau);
    },
  });
}
