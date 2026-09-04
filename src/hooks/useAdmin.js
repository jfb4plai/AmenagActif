import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { useAnnees, useEcoles } from './useEcoleGrid.js';

export { useAnnees, useEcoles };

/** Année active, ou null. */
export function useAnneeActive() {
  const { data: annees = [] } = useAnnees();
  return annees.find((a) => a.active) ?? null;
}

export function useAdminMutations() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['annees'] });
    qc.invalidateQueries({ queryKey: ['ecoles'] });
    qc.invalidateQueries({ queryKey: ['referents'] });
  };

  const ajouterAnnee = useMutation({
    mutationFn: async (libelle) => {
      const { error } = await supabase.from('ar_annees').insert({ libelle: libelle.trim(), active: false });
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const activerAnnee = useMutation({
    mutationFn: async (anneeId) => {
      const { error: e1 } = await supabase.from('ar_annees').update({ active: false }).neq('id', anneeId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from('ar_annees').update({ active: true }).eq('id', anneeId);
      if (e2) throw e2;
    },
    onSuccess: inval,
  });

  const ajouterEcole = useMutation({
    mutationFn: async ({ nom, implantation }) => {
      const { error } = await supabase.from('ar_ecoles').insert({ nom: nom.trim(), implantation: implantation?.trim() || null });
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const majEcole = useMutation({
    mutationFn: async ({ id, nom, implantation, actif }) => {
      const patch = {};
      if (nom !== undefined) patch.nom = nom.trim();
      if (implantation !== undefined) patch.implantation = implantation?.trim() || null;
      if (actif !== undefined) patch.actif = actif;
      const { error } = await supabase.from('ar_ecoles').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const ajouterReferent = useMutation({
    mutationFn: async ({ ecoleId, anneeId, nom, fonction }) => {
      const { error } = await supabase.from('ar_referents_ecole').insert({
        ecole_id: ecoleId, annee_id: anneeId, nom: nom.trim(), fonction,
      });
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const supprimerReferent = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('ar_referents_ecole').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  return { ajouterAnnee, activerAnnee, ajouterEcole, majEcole, ajouterReferent, supprimerReferent };
}

export function useReferents(ecoleId, anneeId) {
  return useQuery({
    queryKey: ['referents', ecoleId, anneeId],
    enabled: !!ecoleId && !!anneeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ar_referents_ecole')
        .select('id, nom, fonction')
        .eq('ecole_id', ecoleId)
        .eq('annee_id', anneeId)
        .order('fonction');
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Vrai si un rappel de bascule d'année doit s'afficher :
 * entre le 15 août et le 31 décembre, et l'année active se termine
 * au plus tard l'année civile en cours (ou aucune année active).
 */
export function besoinBasculeAnnee(anneeActive, now = new Date()) {
  const mois = now.getMonth(); // 0 = janvier
  const enPeriode = (mois === 7 && now.getDate() >= 15) || mois >= 8;
  if (!enPeriode) return false;
  if (!anneeActive) return true;
  const finAnnee = Number(String(anneeActive.libelle).split('-')[1]);
  if (!Number.isFinite(finAnnee)) return false;
  return finAnnee <= now.getFullYear();
}
