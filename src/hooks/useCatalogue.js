import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

export function useCatalogue() {
  return useQuery({
    queryKey: ['catalogue'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [{ data: chapitres, error: e1 }, { data: amenagements, error: e2 }] = await Promise.all([
        supabase.from('ar_chapitres').select('id, ordre, titre').order('ordre'),
        supabase.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type').eq('actif', true).order('ordre'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { chapitres, amenagements };
    },
  });
}
