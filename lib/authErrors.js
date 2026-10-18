// A Supabase belépési hibájának fajtája: csak a valóban rossz adatra mondjuk, hogy hibás
// (net nélkül / túl sok próbálkozásnál ne a jelszót gyanúsítsa). A belépés és a
// jelszócsere (a jelenlegi jelszó ellenőrzése) is ezt használja.
export function signInErrorKind(error) {
  if (error.name === 'AuthRetryableFetchError' || error.status === 0 || !navigator.onLine) return 'offline';
  if (error.status === 429 || error.code === 'over_request_rate_limit') return 'rate';
  if (error.code === 'invalid_credentials' || error.status === 400) return 'invalid';
  return 'other';
}
