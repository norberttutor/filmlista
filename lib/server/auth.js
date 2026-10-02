import { createClient } from '@supabase/supabase-js';

const SERVER_AUTH = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

// Szerveroldali Supabase kliens, csak a belépett felhasználó ellenőrzésére.
// Nem tárol sessiont: minden kérésnél a kliens által küldött tokent vizsgáljuk.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY,
  { auth: SERVER_AUTH }
);

// Az "Authorization: Bearer <access token>" fejlécből a token, vagy null.
function bearerToken(request) {
  const [scheme, token] = (request.headers.get('authorization') ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

// Kiolvassa a felhasználót a kérés tokenjéből.
// Ha nincs token, vagy érvénytelen / lejárt, null-t ad vissza.
export async function getUserFromRequest(request) {
  const token = bearerToken(request);
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data.user;
}

// Kliens a belépett felhasználó nevében: ugyanazok a jogosultságok (RLS), mint a böngészőben.
// Csak getUserFromRequest() ellenőrzése után használd.
export function supabaseAsUser(request) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_KEY, {
    auth: SERVER_AUTH,
    global: { headers: { Authorization: `Bearer ${bearerToken(request)}` } },
  });
}

export function unauthorized() {
  return Response.json(
    { error: 'Lejárt vagy hiányzik a bejelentkezésed. Lépj ki, majd lépj be újra.' },
    { status: 401 }
  );
}
