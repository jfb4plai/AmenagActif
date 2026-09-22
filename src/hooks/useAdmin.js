import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { useAnnees, useEcoles, useEcolesAdmin } from './useEcoleGrid.js';

export { useAnnees, useEcoles, useEcolesAdmin };

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
    qc.invalidateQueries({ queryKey: ['ecoles-admin'] });
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
    mutationFn: async ({ nom, implantation, implantationNom }) => {
      const { error } = await supabase.from('ar_ecoles').insert({
        nom: nom.trim(),
        implantation: implantation?.trim() || null,
        implantation_nom: implantationNom?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const majEcole = useMutation({
    mutationFn: async ({ id, nom, implantation, implantationNom, actif }) => {
      const patch = {};
      if (nom !== undefined) patch.nom = nom.trim();
      if (implantation !== undefined) patch.implantation = implantation?.trim() || null;
      if (implantationNom !== undefined) patch.implantation_nom = implantationNom?.trim() || null;
      if (actif !== undefined) patch.actif = actif;
      const { error } = await supabase.from('ar_ecoles').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  return { ajouterAnnee, activerAnnee, ajouterEcole, majEcole };
}

/** Équipe d'une implantation : comptes référent PLAI + direction (lecture, via RLS). */
export function useEquipeEcole(ecoleId) {
  return useQuery({
    queryKey: ['equipe-ecole', ecoleId],
    enabled: !!ecoleId,
    queryFn: async () => {
      const { data: liens, error: e1 } = await supabase
        .from('ar_profils_acces_ecoles').select('user_id').eq('ecole_id', ecoleId);
      if (e1) throw e1;
      const userIds = liens.map((l) => l.user_id);
      if (userIds.length === 0) return [];
      const { data, error: e2 } = await supabase
        .from('ar_profils_acces')
        .select('user_id, nom, role')
        .in('user_id', userIds)
        .in('role', ['referent_plai', 'direction'])
        .order('role');
      if (e2) throw e2;
      return data;
    },
  });
}

/** Catalogue complet, y compris aménagements désactivés (pour l'admin). */
export function useCatalogueAdmin() {
  return useQuery({
    queryKey: ['catalogue-admin'],
    queryFn: async () => {
      const [{ data: chapitres, error: e1 }, { data: amenagements, error: e2 }] = await Promise.all([
        supabase.from('ar_chapitres').select('id, ordre, titre').order('ordre'),
        supabase.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type, actif').order('ordre'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      return { chapitres, amenagements };
    },
  });
}

export function useCatalogueMutations() {
  const qc = useQueryClient();
  const inval = () => {
    qc.invalidateQueries({ queryKey: ['catalogue'] });
    qc.invalidateQueries({ queryKey: ['catalogue-admin'] });
  };

  const prochainOrdre = async (chapitreId) => {
    const { data } = await supabase
      .from('ar_amenagements').select('ordre').eq('chapitre_id', chapitreId)
      .order('ordre', { ascending: false }).limit(1);
    return (data?.[0]?.ordre ?? 0) + 1;
  };

  const prochainOrdreChapitre = async () => {
    const { data } = await supabase
      .from('ar_chapitres').select('ordre')
      .order('ordre', { ascending: false }).limit(1);
    return (data?.[0]?.ordre ?? 0) + 1;
  };

  const majAmenagement = useMutation({
    mutationFn: async ({ id, libelle, type, actif, chapitreId }) => {
      const patch = {};
      if (libelle !== undefined) patch.libelle = libelle.trim();
      if (type !== undefined) patch.type = type;
      if (actif !== undefined) patch.actif = actif;
      if (chapitreId !== undefined) {
        patch.chapitre_id = chapitreId;
        patch.ordre = await prochainOrdre(chapitreId);
      }
      const { error } = await supabase.from('ar_amenagements').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const ajouterAmenagement = useMutation({
    mutationFn: async ({ chapitreId, libelle, type }) => {
      const ordre = await prochainOrdre(chapitreId);
      const { error } = await supabase.from('ar_amenagements').insert({
        chapitre_id: chapitreId, ordre, libelle: libelle.trim(), type, actif: true,
      });
      if (error) throw error;
    },
    onSuccess: inval,
  });

  const ajouterChapitre = useMutation({
    mutationFn: async ({ titre }) => {
      const ordre = await prochainOrdreChapitre();
      const { error } = await supabase.from('ar_chapitres').insert({ ordre, titre: titre.trim() });
      if (error) throw error;
    },
    onSuccess: inval,
  });

  return { majAmenagement, ajouterAmenagement, ajouterChapitre };
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
