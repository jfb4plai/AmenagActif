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

  // Mode d'un dispositif pour une classe (AR par élève / AU pour toute la classe). L'écran vérifie
  // d'abord bloqueBasculeDispositif ; les droits sont imposés par la RLS (ar_can_editer_structure_ecole).
  const basculerDispositif = useMutation({
    mutationFn: async ({ classeId, chapitreId, pourToute }) => {
      const { error } = await supabase.from('ar_classe_dispositifs').upsert(
        { classe_id: classeId, chapitre_id: chapitreId, pour_toute_la_classe: pourToute, modifie_le: new Date().toISOString() },
        { onConflict: 'classe_id,chapitre_id' },
      );
      if (error) throw error;
    },
    onSuccess: invalider,
  });

  const upsertEleve = useMutation({
    mutationFn: async ({ id, classeId, prenom, initialeNom, commentaire, statut }) => {
      const row = { prenom, initiale_nom: initialeNom ?? '', commentaire: commentaire ?? '', statut };
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

  const deleteClasse = useMutation({
    mutationFn: async ({ id }) => {
      const { error } = await supabase.from('ar_classes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalider,
  });

  const majReferentPlaiClasse = useMutation({
    mutationFn: async ({ classeId, referentPlaiNom }) => {
      const { error } = await supabase.from('ar_classes').update({ referent_plai_nom: referentPlaiNom ?? '' }).eq('id', classeId);
      if (error) throw error;
    },
    onSuccess: invalider,
  });

  const majCommentaireClasse = useMutation({
    mutationFn: async ({ classeId, commentaire }) => {
      // Vide -> null (le trigger tient aussi la date de dernière modification).
      const { error } = await supabase.from('ar_classes').update({ commentaire: commentaire.trim() || null }).eq('id', classeId);
      if (error) throw error;
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

  return { toggleAR, toggleAU, basculerDispositif, upsertEleve, deleteEleve, ensureClasse, deleteClasse, majReferentPlaiClasse, majCommentaireClasse, addLibre, removeLibre };
}
