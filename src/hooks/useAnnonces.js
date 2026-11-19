import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

async function apiAnnonces(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/annonces', {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Erreur serveur.');
  return json;
}

/** { annonces, effectifs } : derniers envois réels et nombre de comptes par rôle. */
export function useAnnonces() {
  return useQuery({ queryKey: ['annonces'], queryFn: () => apiAnnonces() });
}

/** action : 'test' (exemplaire à tous les administrateurs) ou 'envoyer' (envoi réel). */
export function useEnvoyerAnnonce() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, sujet, corps, roles }) => apiAnnonces({ action, sujet, corps, roles }),
    onSuccess: (_r, { action }) => { if (action === 'envoyer') qc.invalidateQueries({ queryKey: ['annonces'] }); },
  });
}
