import { supabase } from '@/lib/supabase';

// GET kérés a saját /api route-jainkhoz a belépett felhasználó tokenjével.
// Hiba esetén a szerver magyar üzenetével dob Error-t.
export async function apiGet(path, params, { signal } = {}) {
  // mindig a friss sessiont kérjük el, mert a token óránként megújul
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? '';

  let res;
  try {
    res = await fetch(`${path}?${new URLSearchParams(params)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error(
      'Nem sikerült elérni a szervert. Ellenőrizd az internetkapcsolatot, és próbáld újra.'
    );
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Váratlan szerverhiba (${res.status}). Próbáld újra később.`);
  }
  return body;
}
