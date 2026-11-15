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
// függetlenül az RLS védi.
// → { user: { id, email } } vagy { response }: nincs token / érvénytelen / lejárt / névtelen (anonymous) munkamenet →
// 401 (R19: a névtelen fiók sem); ha az ellenőrzés maga nem sikerül (a kulcs letöltése, hálózat) → 503, hogy a kliens
// ne „Lépj be újra”-t mondjon (átnézés 3, R27). Használat: const auth = await checkAuth(request);
// if (auth.response) return auth.response;
export async function checkAuth(request) {
  const token = bearerToken(request);
  if (!token) return { response: unauthorized() };

  let result;
  try {
    result = await supabase.auth.getClaims(token);
  } catch (err) {
    console.error(err);
    return { response: authUnavailable() };
  }
  const { data, error } = result;
  if (error && (error.name === 'AuthRetryableFetchError' || (error.status ?? 0) >= 500)) {
    console.error(error);
    return { response: authUnavailable() };
  }
  const claims = data?.claims;
  if (error || !claims?.sub || claims.role !== 'authenticated' || claims.is_anonymous) return { response: unauthorized() };
  return { user: { id: claims.sub, email: claims.email ?? null } };
}

function authUnavailable() {
  return Response.json(
    { error: 'A bejelentkezés ellenőrzése most nem sikerült. Próbáld újra pár perc múlva.' },
    { status: 503 }
  );
}

// Kliens a belépett felhasználó nevében: ugyanazok a jogosultságok (RLS), mint a böngészőben.
// Csak checkAuth() ellenőrzése után használd.
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
