import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase.js';

/** Tous les comptes agent_plai du pôle (nom, email) — pour l'assignation d'accompagnants. */
export function useAgentsPlai() {
  return useQuery({
    queryKey: ['agents-plai'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/agents-plai', {
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Erreur serveur.');
      return json.agents;
    },
  });
}
