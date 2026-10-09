import 'server-only'; // kliens-komponensből importálva a build hibát ad (kódaudit #45)
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

// Kiolvassa a felhasználót a kérés tokenjéből: a token aláírását helyben, a projekt nyilvános
// kulcsával ellenőrzi (getClaims; a projekt aszimmetrikus – ES256 – kulccsal ír alá, a nyilvános
// kulcs a szerverpéldányban gyorsítótárazva: nincs hálózati kör a Supabase Authhoz – terv-3 34,
// E3, Norbi döntése, 2026-10-06). Eltérés a korábbi getUser()-től: egy máshol kijelentkeztetett
// munkamenet tokenje a lejáratáig (legfeljebb 1 óra) még elfogadott – az adatokat ettől
// függetlenül az RLS védi. Ha nincs token, vagy érvénytelen / lejárt, null-t ad vissza.
export async function getUserFromRequest(request) {
  const token = bearerToken(request);
  if (!token) return null;

  const { data, error } = await supabase.auth.getClaims(token);
  const claims = data?.claims;
  if (error || !claims?.sub || claims.role !== 'authenticated') return null;
  return { id: claims.sub, email: claims.email ?? null };
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
