import { supabase } from '@/lib/supabase';

// Hibanapló (terv-3 113, 28_client_errors.sql): a böngészőben történt hibák a client_errors táblába
// kerülnek (log_client_error – az ismétlődőt a szerver összevonja; Mamáé a gazdája naplójába), a ⋮
// „Hibák (N)” ablak mutatja. Fajták: 'error' (el nem kapott hiba), 'rejection' (kezeletlen ígéret-hiba),
// 'render' (a hibalap – app/error.js), 'save' (sikertelen adatbázis-művelet – mentés / betöltés).
// Nem kerül be: a hálózati hiba (net nélkül nem is küldhető, és várható), a megszakított kérés, a
// böngésző zaja (ResizeObserver); egy munkamenetben ugyanaz legfeljebb percenként egyszer, összesen
// legfeljebb 30 küldés.

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';
const MAX_SENDS = 30;
const REPEAT_MS = 60 * 1000;
const NOISE = /^Script error\.?$|ResizeObserver loop|Failed to fetch|NetworkError|Load failed|network error|ERR_INTERNET_DISCONNECTED|The user aborted|signal is aborted/i;

let sends = 0;
const lastSent = new Map(); // fajta + üzenet → időbélyeg

function describe(error) {
  if (error instanceof Error) return { message: `${error.name && error.name !== 'Error' ? `${error.name}: ` : ''}${error.message}`, stack: error.stack ?? null };
  // a Supabase (PostgREST) hibája sima objektum: message, code, details, hint
  if (error && typeof error === 'object') {
    const parts = [error.message, error.code && `(kód: ${error.code})`, error.details, error.hint].filter(Boolean);
    return { message: parts.join(' ') || JSON.stringify(error).slice(0, 500), stack: null };
  }
  return { message: String(error), stack: null };
}

// a hiba naplózása (a hívó dönti el a fajtát); csendben elnyel minden saját hibát
export function logError(kind, error) {
  try {
    if (typeof window === 'undefined' || !navigator.onLine) return;
    if (error?.name === 'AbortError') return;
    const { message, stack } = describe(error);
    if (NOISE.test(message)) return;
    const key = `${kind}|${message}`;
    const now = Date.now();
    if (now - (lastSent.get(key) ?? 0) < REPEAT_MS || sends >= MAX_SENDS) return;
    lastSent.set(key, now);
    sends++;
    supabase
      .rpc('log_client_error', {
        p_kind: kind,
        p_message: message,
        p_stack: stack,
        p_url: location.pathname + location.search,
        p_app_version: VERSION,
        p_user_agent: navigator.userAgent,
      })
      .then(({ error: e }) => e && console.warn('A hiba naplózása nem sikerült:', e.message));
  } catch {
    // a napló maga ne okozzon újabb hibát
  }
}

// a sikertelen adatbázis-művelet: a konzolra is (mint eddig), és a naplóba
export function reportError(error, ...more) {
  console.error(error, ...more);
  logError('save', error);
}

// az el nem kapott hibák és a kezeletlen ígéret-hibák figyelése (az app/page.js indítja, egyszer)
let started = false;
export function startErrorLog() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('error', (e) => {
    // (a kép / szkript betöltési hibája is ide jön, de Error nélkül – az nem kell)
    if (e.error || e.message) logError('error', e.error ?? new Error(e.message));
  });
  window.addEventListener('unhandledrejection', (e) => logError('rejection', e.reason));
}

// ---------- a ⋮ „Hibák (N)” ablak ----------

export const ERROR_KINDS = {
  error: 'Váratlan hiba',
  rejection: 'Kezeletlen hiba (háttérművelet)',
  render: 'Hibalap',
  save: 'Sikertelen mentés / betöltés',
};

const COLUMNS = 'id, user_id, kind, message, stack, url, app_version, user_agent, count, first_at, last_at, seen_at';

// a napló (a sajátom és Mamáé), a legutóbb előfordult elöl; a szerver legfeljebb 200-at tart
export async function listErrors() {
  const { data, error } = await supabase
    .from('client_errors')
    .select(COLUMNS)
    .order('last_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) {
    console.error(error); // (nem reportError: a napló betöltésének hibája ne kerüljön a naplóba)
    throw new Error('Nem sikerült betölteni a hibanaplót. Próbáld újra.');
  }
  return data;
}

// { total, unseen } – a ⋮ menüpont felirata ebből
export async function errorCounts() {
  const [all, fresh] = await Promise.all([
    supabase.from('client_errors').select('id', { count: 'exact', head: true }),
    supabase.from('client_errors').select('id', { count: 'exact', head: true }).is('seen_at', null),
  ]);
  if (all.error || fresh.error) throw all.error ?? fresh.error;
  return { total: all.count ?? 0, unseen: fresh.count ?? 0 };
}

// a megnyitáskor látott olvasatlanok olvasottak lesznek (csak ezek – a közben jött olvasatlan marad)
export async function markErrorsSeen(ids) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('client_errors')
    .update({ seen_at: new Date().toISOString() })
    .in('id', ids)
    .is('seen_at', null);
  if (error) console.warn('A hibák olvasottra állítása sikertelen:', error.message);
}

export async function deleteErrors(ids) {
  const { error } = await supabase.from('client_errors').delete().in('id', ids);
  if (error) {
    console.error(error);
    throw new Error('Nem sikerült törölni. Próbáld újra.');
  }
}
