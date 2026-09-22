import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/** Accompagnants assignés à chaque élève d'un ensemble donné (eleveIds). */
export function useAccompagnantsEleves(eleveIds) {
  return useQuery({
    queryKey: ['accompagnants', [...eleveIds].sort()],
    enabled: eleveIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ar_accompagnants_eleve').select('eleve_id, user_id').in('eleve_id', eleveIds);
      if (error) throw error;
      return data;
    },
  });
}

export function useAccompagnantsMutations() {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['accompagnants'] });

  const assigner = useMutation({
    mutationFn: async ({ eleveId, userId }) => {
      const { error } = await supabase.from('ar_accompagnants_eleve').insert({ eleve_id: eleveId, user_id: userId });
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: inval,
  });

  const retirer = useMutation({
    mutationFn: async ({ eleveId, userId }) => {
      const { error } = await supabase.from('ar_accompagnants_eleve').delete().eq('eleve_id', eleveId).eq('user_id', userId);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  return { assigner, retirer };
}
