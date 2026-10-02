import { supabase } from '@/lib/supabase';

// Kérés a saját /api route-jainkhoz a belépett felhasználó tokenjével.
// Hiba esetén a szerver magyar üzenetével dob Error-t.
async function apiRequest(method, path, { params, body, signal } = {}) {
  // mindig a friss sessiont kérjük el, mert a token óránként megújul
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? '';

  let res;
  try {
    res = await fetch(params ? `${path}?${new URLSearchParams(params)}` : path, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body && { 'Content-Type': 'application/json' }),
      },
      body: body && JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error(
      'Nem sikerült elérni a szervert. Ellenőrizd az internetkapcsolatot, és próbáld újra.'
    );
  }

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error ?? `Váratlan szerverhiba (${res.status}). Próbáld újra később.`);
  }
  return json;
}

export function apiGet(path, params, { signal } = {}) {
  return apiRequest('GET', path, { params, signal });
}

export function apiPost(path, body) {
  return apiRequest('POST', path, { body });
}
