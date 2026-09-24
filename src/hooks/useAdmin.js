import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../lib/auth.jsx';
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

/** Écoles auxquelles LE COMPTE COURANT est personnellement rattaché (table de
 * liaison), quel que soit son rôle. Pour un admin, useEcoles() renvoie déjà
 * toutes les écoles (ar_is_admin() court-circuite la RLS) — ce hook sert à
 * retrouver uniquement celles où il est identifié comme personne de terrain
 * (voir MonEcole.jsx). Pour les autres rôles, useEcoles() est déjà scopé par
 * la RLS et ce hook n'est pas nécessaire. */
export function useMesEcolesLiees() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['mes-ecoles-liees', session?.user?.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.from('ar_profils_acces_ecoles').select('ecole_id').eq('user_id', session.user.id);
      if (error) throw error;
      return data.map((d) => d.ecole_id);
    },
  });
}

/** Équipe d'une implantation : référent PLAI + direction (multi-écoles, table de
 * liaison), agents accompagnants (rattachement direct, une seule école), et
 * administrateurs rattachés facultativement (identification "terrain" — même
 * table de liaison, aucun droit supplémentaire) — lecture, via RLS. */
export function useEquipeEcole(ecoleId) {
  return useQuery({
    queryKey: ['equipe-ecole', ecoleId],
    enabled: !!ecoleId,
    queryFn: async () => {
      const [{ data: liens, error: e1 }, { data: directs, error: e1b }] = await Promise.all([
        supabase.from('ar_profils_acces_ecoles').select('user_id').eq('ecole_id', ecoleId),
        supabase.from('ar_profils_acces').select('user_id').eq('ecole_id', ecoleId),
      ]);
      if (e1) throw e1;
      if (e1b) throw e1b;
      const userIds = [...new Set([...liens.map((l) => l.user_id), ...directs.map((d) => d.user_id)])];
      if (userIds.length === 0) return [];
      const { data, error: e2 } = await supabase
        .from('ar_profils_acces')
        .select('user_id, nom, role')
        .in('user_id', userIds)
        .in('role', ['referent_plai', 'direction', 'agent_plai', 'admin'])
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
        supabase.from('ar_chapitres').select('id, ordre, titre, code').order('ordre'),
        supabase.from('ar_amenagements').select('id, chapitre_id, ordre, libelle, type, actif, code, partage_profil').order('ordre'),
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
    // Ne JAMAIS y mettre `code` : immuable (trigger SQL), généré automatiquement à la création.
    mutationFn: async ({ id, libelle, type, actif, chapitreId, partageProfil }) => {
      const patch = {};
      if (partageProfil !== undefined) patch.partage_profil = partageProfil;
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
    // Le code est généré par la base (déclencheur BEFORE INSERT) : il n'est plus saisi.
    // partage_profil vaut true par défaut côté base ; on ne l'envoie que pour poser l'exception.
    mutationFn: async ({ chapitreId, libelle, type, partageProfil = true }) => {
      const ordre = await prochainOrdre(chapitreId);
      const { error } = await supabase.from('ar_amenagements').insert({
        chapitre_id: chapitreId, ordre, libelle: libelle.trim(), type, actif: true,
        ...(partageProfil === false ? { partage_profil: false } : {}),
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

  // Écran de revue « Transmission aux autres apps » : un aménagement (id) ou tout un chapitre (chapitreId).
  // Ne touche qu'à partage_profil. Vérifie qu'au moins une ligne a été modifiée : une RLS qui refuse
  // un UPDATE renvoie 0 ligne sans erreur, ce qui serait un échec silencieux.
  const majPartageProfil = useMutation({
    mutationFn: async ({ id, chapitreId, valeur }) => {
      let q = supabase.from('ar_amenagements').update({ partage_profil: valeur });
      q = id ? q.eq('id', id) : q.eq('chapitre_id', chapitreId);
      const { data, error } = await q.select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Aucune ligne modifiée (droits insuffisants ou élément introuvable).");
      return data.length;
    },
    onSuccess: inval,
  });

  return { majAmenagement, ajouterAmenagement, ajouterChapitre, majPartageProfil };
}

// Fonction pure déplacée dans src/domain/basculeAnnee.js ; ré-exportée pour compatibilité.
export { besoinBasculeAnnee } from '../domain/basculeAnnee.js';
