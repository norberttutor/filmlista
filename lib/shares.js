import { supabase } from '@/lib/supabase';

// Megosztható nézési sorrend (terv-3 41): franchise-onként legfeljebb egy csak olvasható,
// nyilvános link (/sorrend/<token>; franchise_shares – 20_franchise_share.sql). A visszavonás a sor
// törlése: a régi link többé nem nyílik meg, egy új link már más tokent kap.

export const shareUrl = (token) => `${window.location.origin}/sorrend/${token}`;

function shareError(error) {
  console.error(error);
  return new Error(
    'Nem sikerült a megosztás. Próbáld újra; ha továbbra sem megy, nézd meg a böngésző konzolját (F12).'
  );
}

// a franchise linkjének tokenje, vagy null
export async function loadShare(franchiseId) {
  const { data, error } = await supabase
    .from('franchise_shares')
    .select('token')
    .eq('franchise_id', franchiseId)
    .maybeSingle();
  if (error) throw shareError(error);
  return data?.token ?? null;
}

export async function createShare(franchiseId) {
  const { data, error } = await supabase
    .from('franchise_shares')
    .insert({ franchise_id: franchiseId })
    .select('token')
    .single();
  if (error) throw shareError(error);
  return data.token;
}

export async function revokeShare(franchiseId) {
  const { error } = await supabase.from('franchise_shares').delete().eq('franchise_id', franchiseId);
  if (error) throw shareError(error);
}
