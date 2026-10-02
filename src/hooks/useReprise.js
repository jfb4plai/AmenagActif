import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/** Données de l'assistant pour UNE implantation : classes/élèves de N, classes de N+1 (toutes implantations lisibles), élèves déjà repris. */
export function useReprise(ecoleId, srcAnneeId, cibleAnneeId) {
  return useQuery({
    queryKey: ['reprise', ecoleId, srcAnneeId, cibleAnneeId],
    enabled: !!ecoleId && !!srcAnneeId && !!cibleAnneeId && srcAnneeId !== cibleAnneeId,
    queryFn: async () => {
      const [src, cible] = await Promise.all([
        supabase.from('ar_classes').select('id, nom, niveau, ecole_id').eq('ecole_id', ecoleId).eq('annee_id', srcAnneeId).order('nom'),
        supabase.from('ar_classes').select('id, nom, niveau, ecole_id').eq('annee_id', cibleAnneeId).order('nom'),
      ]);
      if (src.error) throw src.error;
      if (cible.error) throw cible.error;

      const classeIds = src.data.map((c) => c.id);
      let eleves = [];
      if (classeIds.length) {
        const { data, error } = await supabase
          .from('ar_eleves').select('id, classe_id, prenom, initiale_nom, devenir').in('classe_id', classeIds).order('prenom');
        if (error) throw error;
        eleves = data;
      }

      let dejaRepris = [];
      if (eleves.length) {
        const { data, error } = await supabase.rpc('ar_eleves_deja_repris', { p_ids: eleves.map((e) => e.id) });
        if (error) throw error;
        dejaRepris = data ?? [];
      }
      return { classesSource: src.data, classesCible: cible.data, eleves, dejaRepris };
    },
  });
}

/** File admin : élèves marqués « autre implantation » et pas encore repris (toutes implantations). */
export function useTransferts(srcAnneeId, cibleAnneeId, enabled) {
  return useQuery({
    queryKey: ['transferts', srcAnneeId, cibleAnneeId],
    enabled: !!enabled && !!srcAnneeId && !!cibleAnneeId,
    queryFn: async () => {
      const [el, cl] = await Promise.all([
        supabase.from('ar_eleves')
          .select('id, prenom, initiale_nom, ar_classes!inner(nom, ecole_id, annee_id)')
          .eq('devenir', 'transfert').eq('ar_classes.annee_id', srcAnneeId),
        supabase.from('ar_classes').select('id, nom, niveau, ecole_id').eq('annee_id', cibleAnneeId).order('nom'),
      ]);
      if (el.error) throw el.error;
      if (cl.error) throw cl.error;

      let eleves = el.data;
      if (eleves.length) {
        const { data, error } = await supabase.rpc('ar_eleves_deja_repris', { p_ids: eleves.map((e) => e.id) });
        if (error) throw error;
        const deja = new Set(data ?? []);
        eleves = eleves.filter((e) => !deja.has(e.id));
      }
      return { eleves, classesCible: cl.data };
    },
  });
}

export function useRepriseMutations(ecoleId, srcAnneeId, cibleAnneeId) {
  const qc = useQueryClient();
  const invalider = () => {
    qc.invalidateQueries({ queryKey: ['reprise'] });
    qc.invalidateQueries({ queryKey: ['transferts'] });
    qc.invalidateQueries({ queryKey: ['grille'] });
  };

  const cloner = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('ar_cloner_classes', {
        p_ecole: ecoleId, p_source: srcAnneeId, p_cible: cibleAnneeId,
      });
      if (error) throw error;
      return data; // nombre de classes créées
    },
    onSuccess: invalider,
  });

  const majNiveau = useMutation({
    mutationFn: async ({ classeId, niveau }) => {
      const { error } = await supabase.from('ar_classes').update({ niveau: niveau.trim() || null }).eq('id', classeId);
      if (error) throw error;
    },
    onSuccess: invalider,
  });

  /** Exécute les reprises une à une (chaque RPC est atomique) puis écrit les devenirs. Un élève déjà repris (23505) n'est pas une erreur. */
  const appliquer = useMutation({
    mutationFn: async ({ operations, marquages }) => {
      const echecs = [];
      let repris = 0;
      for (const op of operations) {
        const { error } = await supabase.rpc('ar_reprendre_eleve', { p_source: op.sourceId, p_classe_cible: op.classeId });
        if (!error) repris += 1;
        else if (error.code !== '23505') echecs.push({ sourceId: op.sourceId, message: error.message });
      }
      for (const m of marquages) {
        const { error } = await supabase.from('ar_eleves').update({ devenir: m.devenir }).eq('id', m.id);
        if (error) echecs.push({ sourceId: m.id, message: error.message });
      }
      return { repris, echecs };
    },
    onSuccess: invalider,
  });

  const reprendreUn = useMutation({
    mutationFn: async ({ sourceId, classeId }) => {
      const { error } = await supabase.rpc('ar_reprendre_eleve', { p_source: sourceId, p_classe_cible: classeId });
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: invalider,
  });

  return { cloner, majNiveau, appliquer, reprendreUn };
}
