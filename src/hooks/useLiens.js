import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

async function apiLiens(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/liens', {
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

/** Remplace la liste des classes d'un sommaire (le serveur refuse fusion, lien révoqué/expiré, liste vide). */
export function useDefinirClasses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lienId, classeIds }) => apiLiens({ action: 'definir_classes', lien_id: lienId, classe_ids: classeIds }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['liens'] }),
  });
}
