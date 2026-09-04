import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

async function apiMembres(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch('/api/membres', {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Erreur serveur.');
  return json;
}

export function useMembres() {
  return useQuery({ queryKey: ['membres'], queryFn: () => apiMembres().then((j) => j.membres) });
}

export function useMembresMutations() {
  const qc = useQueryClient();
  const inval = () => qc.invalidateQueries({ queryKey: ['membres'] });
  return {
    inviter: useMutation({ mutationFn: (p) => apiMembres({ action: 'invite', ...p }), onSuccess: inval }),
    changerRole: useMutation({ mutationFn: (p) => apiMembres({ action: 'setProfil', ...p }), onSuccess: inval }),
    retirer: useMutation({ mutationFn: (userId) => apiMembres({ action: 'revoke', userId }), onSuccess: inval }),
  };
}
