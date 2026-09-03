import { supabase } from './supabase.js';

export async function telechargerPdf(type, id) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`/api/fiche-pdf?type=${type}&id=${id}`, {
    headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
  });
  if (!res.ok) throw new Error('Génération PDF impossible');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
