import { createClient } from '@supabase/supabase-js';

// Szerveroldali Supabase kliens, csak a belépett felhasználó ellenőrzésére.
// Nem tárol sessiont: minden kérésnél a kliens által küldött tokent vizsgáljuk.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

// Az "Authorization: Bearer <access token>" fejlécből kiolvassa a felhasználót.
// Ha nincs token, vagy érvénytelen / lejárt, null-t ad vissza.
export async function getUserFromRequest(request) {
  const [scheme, token] = (request.headers.get('authorization') ?? '').split(' ');
  if (scheme !== 'Bearer' || !token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user;
}

export function unauthorized() {
  return Response.json(
    { error: 'Lejárt vagy hiányzik a bejelentkezésed. Lépj ki, majd lépj be újra.' },
    { status: 401 }
  );
}
