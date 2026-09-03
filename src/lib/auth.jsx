import { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return <AuthCtx.Provider value={{ session, ready }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth hors AuthProvider');
  return ctx;
}

/** @returns {{ role: 'plai'|'direction'|null, ecoleId: string|null, isPlai: boolean, loading: boolean }} */
export function useRole() {
  const { session, ready } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['role', session?.user?.id],
    enabled: ready && !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ar_profils_acces')
        .select('role, ecole_id')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  return {
    role: data?.role ?? null,
    ecoleId: data?.ecole_id ?? null,
    isPlai: data?.role === 'plai' && !data?.ecole_id,
    loading: !ready || (!!session && isLoading),
  };
}
