import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { aConfirmerParClasse } from '../domain/reprise.js';

/**
 * Ce qui reste « à confirmer » dans une ou plusieurs classes (AR et libres des élèves, AU de classe).
 * Avertissement consultatif avant l'envoi d'un lien : en cas d'erreur, la requête échoue sans bloquer la page
 * (data reste undefined, aucun avertissement n'est affiché).
 */
export function useAConfirmerClasses(classeIds) {
  return useQuery({
    queryKey: ['a-confirmer-classes', classeIds],
    enabled: Array.isArray(classeIds) && classeIds.length > 0,
    retry: false,
    queryFn: async () => {
      const { data: eleves, error } = await supabase.from('ar_eleves').select('id, prenom, initiale_nom').in('classe_id', classeIds);
      if (error) throw error;
      const ids = eleves.map((e) => e.id);
      const vide = Promise.resolve({ data: [], error: null });
      const [sel, lib, au] = await Promise.all([
        ids.length ? supabase.from('ar_selections').select('eleve_id, a_confirmer').eq('a_confirmer', true).in('eleve_id', ids) : vide,
        ids.length ? supabase.from('ar_amenagements_libres').select('eleve_id, a_confirmer').eq('a_confirmer', true).in('eleve_id', ids) : vide,
        supabase.from('ar_amenagements_classe').select('classe_id, a_confirmer').eq('a_confirmer', true).in('classe_id', classeIds),
      ]);
      for (const r of [sel, lib, au]) if (r.error) throw r.error;
      return aConfirmerParClasse({ eleves, selectionsAR: sel.data, libres: lib.data, auClasse: au.data });
    },
  });
}
