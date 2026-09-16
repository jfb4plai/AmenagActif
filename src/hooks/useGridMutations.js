import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/** Toutes les mutations invalident la grille de l'école/année courante. */
export function useGridMutations(ecoleId, anneeId) {
  const qc = useQueryClient();
  const invalider = () => qc.invalidateQueries({ queryKey: ['grille', ecoleId, anneeId] });

  const toggleAR = useMutation({
    mutationFn: async ({ eleveId, amenagementId, actif }) => {
      if (actif) {
        const { error } = await supabase.from('ar_selections').insert({ eleve_id: eleveId, amenagement_id: amenagementId });
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabase.from('ar_selections').delete().eq('eleve_id', eleveId).eq('amenagement_id', amenagementId);
        if (error) throw error;
      }
    },
    onSuccess: invalider,
  });

  const toggleAU = useMutation({
    mutationFn: async ({ classeId, amenagementId, actif }) => {
      if (actif) {
        const { error } = await supabase.from('ar_amenagements_classe').insert({ classe_id: classeId, amenagement_id: amenagementId });
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabase.from('ar_amenagements_classe').delete().eq('classe_id', classeId).eq('amenagement_id', amenagementId);
        if (error) throw error;
      }
    },
    onSuccess: invalider,
  });

  const upsertEleve = useMutation({
    mutationFn: async ({ id, classeId, prenom, initialeNom, referentPlaiNom, commentaire }) => {
      const row = { prenom, initiale_nom: initialeNom ?? '', referent_plai_nom: referentPlaiNom ?? '', commentaire: commentaire ?? '' };
      if (id) {
        const { error } = await supabase.from('ar_eleves').update(row).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ar_eleves').insert({ ...row, classe_id: classeId });
        if (error) throw error;
      }
    },
    onSuccess: invalider,
  });

  const deleteEleve = useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.from('ar_eleves').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalider,
  });

  const ensureClasse = useMutation({
    mutationFn: async ({ nom, niveau }) => {
      const { data, error } = await supabase
        .from('ar_classes')
        .upsert({ ecole_id: ecoleId, annee_id: anneeId, nom, niveau: niveau ?? null }, { onConflict: 'ecole_id,annee_id,nom' })
        .select('id').single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: invalider,
  });

  const addLibre = useMutation({
    mutationFn: async ({ eleveId, chapitreId, texte }) => {
      const { error } = await supabase.from('ar_amenagements_libres').insert({ eleve_id: eleveId, chapitre_id: chapitreId ?? null, texte });
      if (error) throw error;
    },
    onSuccess: invalider,
  });

  const removeLibre = useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.from('ar_amenagements_libres').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalider,
  });

  return { toggleAR, toggleAU, upsertEleve, deleteEleve, ensureClasse, addLibre, removeLibre };
}
