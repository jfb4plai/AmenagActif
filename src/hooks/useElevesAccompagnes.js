import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/** Élèves assignés à l'agent connecté, toutes écoles confondues, avec contexte classe/école. */
export function useElevesAccompagnes(userId) {
  return useQuery({
    queryKey: ['eleves-accompagnes', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: assignations, error: e1 } = await supabase
        .from('ar_accompagnants_eleve').select('eleve_id').eq('user_id', userId);
      if (e1) throw e1;
      const eleveIds = assignations.map((a) => a.eleve_id);
      if (eleveIds.length === 0) return { eleves: [], classes: [], ecoles: [] };

      const { data: eleves, error: e2 } = await supabase
        .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, commentaire, statut').in('id', eleveIds).order('prenom');
      if (e2) throw e2;

      const classeIds = [...new Set(eleves.map((e) => e.classe_id))];
      const { data: classes, error: e3 } = await supabase
        .from('ar_classes').select('id, nom, niveau, ecole_id, annee_id').in('id', classeIds);
      if (e3) throw e3;

      const ecoleIds = [...new Set(classes.map((c) => c.ecole_id))];
      const { data: ecoles, error: e4 } = await supabase
        .from('ar_ecoles').select('id, nom').in('id', ecoleIds);
      if (e4) throw e4;

      return { eleves, classes, ecoles };
    },
  });
}
