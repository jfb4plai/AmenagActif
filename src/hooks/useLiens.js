import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

async function apiLiens(body, query = '') {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/liens${query}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Erreur serveur.');
  return json;
}

/** { ecoles, liens } : les erreurs sont levées, l'écran les affiche. */
export function useLiens() {
  return useQuery({ queryKey: ['liens'], queryFn: () => apiLiens() });
}

export function useRevoquerLien() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lienId) => apiLiens({ action: 'revoke', lien_id: lienId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['liens'] }),
  });
}

/**
 * Toutes les classes d'un lien ({ lien_id, classe_ids }), lues par le serveur (mêmes contrôles d'accès que la
 * modification). Source de référence du dialogue « Modifier les classes » : la liste globale peut être tronquée.
 * gcTime 0 : chaque ouverture du dialogue relit la base ; pas de relecture en arrière-plan pendant qu'il est ouvert.
 */
export function useClassesDuLien(lienId) {
  return useQuery({
    queryKey: ['liens-classes', lienId],
    queryFn: () => apiLiens(undefined, `?lien_id=${encodeURIComponent(lienId)}`),
    enabled: Boolean(lienId),
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}

/**
 * Remplace la liste des classes d'un sommaire (le serveur refuse fusion, lien révoqué/expiré, liste vide).
 * classeIdsAvant : liste lue à l'ouverture ; le serveur répond 409 si elle a changé entre-temps.
 */
export function useDefinirClasses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lienId, classeIds, classeIdsAvant }) => apiLiens({
      action: 'definir_classes', lien_id: lienId, classe_ids: classeIds,
      ...(classeIdsAvant ? { classe_ids_avant: classeIdsAvant } : {}),
    }),
    onSuccess: (_r, { lienId }) => {
      qc.invalidateQueries({ queryKey: ['liens'] });
      qc.removeQueries({ queryKey: ['liens-classes', lienId] });
    },
  });
}
