import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/**
 * Classes de l'année que l'utilisateur peut LIRE (la RLS filtre : un référent d'une seule école ne voit que la sienne,
 * l'admin voit tout) et modes AU des dispositifs. Sert de liste de destinations pour « Changer de classe ».
 * Les modes sont filtrés sur pour_toute_la_classe = true (seuls ces modes comptent) et rattachés aux classes côté client :
 * un `.in('classe_id', …)` de plusieurs centaines d'identifiants dépasserait la longueur d'URL de PostgREST.
 */
export function useClassesCibles(anneeId) {
  return useQuery({
    queryKey: ['classes-cibles', anneeId],
    enabled: !!anneeId,
    queryFn: async () => {
      const { data: classes, error } = await supabase
        .from('ar_classes').select('id, nom, niveau, ecole_id').eq('annee_id', anneeId).order('nom');
      if (error) throw error;
      const { data: modes, error: em } = await supabase
        .from('ar_classe_dispositifs').select('classe_id, chapitre_id, pour_toute_la_classe').eq('pour_toute_la_classe', true);
      if (em) throw em;
      const ids = new Set(classes.map((c) => c.id));
      return { classes, modes: modes.filter((m) => ids.has(m.classe_id)) };
    },
  });
}
