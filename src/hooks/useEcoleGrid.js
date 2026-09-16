import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

export function useEcoles() {
  return useQuery({
    queryKey: ['ecoles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ar_ecoles').select('id, nom, implantation').eq('actif', true).order('nom');
      if (error) throw error;
      return data;
    },
  });
}

export function useAnnees() {
  return useQuery({
    queryKey: ['annees'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ar_annees').select('id, libelle, active').order('libelle', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Charge tout ce qu'il faut pour la grille d'une école/année. */
export function useEcoleGrid(ecoleId, anneeId) {
  return useQuery({
    queryKey: ['grille', ecoleId, anneeId],
    enabled: !!ecoleId && !!anneeId,
    queryFn: async () => {
      const { data: classes, error: ec } = await supabase
        .from('ar_classes').select('id, nom, niveau, referent_plai_nom').eq('ecole_id', ecoleId).eq('annee_id', anneeId).order('nom');
      if (ec) throw ec;
      const classeIds = classes.map((c) => c.id);
      if (classeIds.length === 0) return { classes, eleves: [], selectionsAR: [], auClasse: [], libres: [] };

      const { data: eleves, error: ee } = await supabase
        .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, commentaire').in('classe_id', classeIds).order('prenom');
      if (ee) throw ee;
      const eleveIds = eleves.map((e) => e.id);

      const [{ data: auClasse, error: e1 }, sel, lib] = await Promise.all([
        supabase.from('ar_amenagements_classe').select('classe_id, amenagement_id, cree_le').in('classe_id', classeIds),
        eleveIds.length
          ? supabase.from('ar_selections').select('eleve_id, amenagement_id, cree_le').in('eleve_id', eleveIds)
          : Promise.resolve({ data: [], error: null }),
        eleveIds.length
          ? supabase.from('ar_amenagements_libres').select('id, eleve_id, chapitre_id, texte').in('eleve_id', eleveIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (e1) throw e1;
      if (sel.error) throw sel.error;
      if (lib.error) throw lib.error;

      return { classes, eleves, selectionsAR: sel.data, auClasse, libres: lib.data };
    },
  });
}
