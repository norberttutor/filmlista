// Háttérfrissítések: melyik cím esedékes (terv-3 34, E2, 2026-10-06). Közös a böngészőnek és a
// route-oknak: a Watchlist a betöltött listából dönti el, kell-e egyáltalán hívnia a
// /api/imdb/refresh, /api/tmdb/backdrops, /api/tmdb/seasons, /api/tmdb/releases route-ot (ha nincs
// esedékes cím, nem hív – a legtöbb betöltésnél így van), a route-ok ugyanezzel válogatnak – így
// a kettő nem térhet el. A mezők a titles_with_genres nézetben is megvannak.

const DAY_MS = 864e5;
export const IMDB_REFRESH_DAYS = 14; // ennél régebbi IMDb-értékelést újra lekérünk
export const SEASONS_REFRESH_DAYS = 7; // ennél régebben ellenőrzött sorozat évadait újra megnézzük
export const RELEASE_RECHECK_DAYS = 3; // a megjelenési dátumokat ennyi naponta nézzük újra

// a mai nap Budapesten (mint az adatbázisban)
export const budapestToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });
const addDays = (iso, n) => new Date(Date.parse(iso) + n * DAY_MS).toISOString().slice(0, 10);
const olderThan = (iso, days, now) => !iso || Date.parse(iso) < now - days * DAY_MS;

// IMDb-értékelés: van IMDb ID, és hiányzik vagy 14 napnál régebbi
export const imdbDue = (t, now = Date.now()) =>
  t.imdb_id != null && olderThan(t.imdb_rating_updated_at, IMDB_REFRESH_DAYS, now);

// háttérkép: még nem néztük meg (a route SQL-ben ugyanezt kérdezi: backdrop_checked_at is null)
export const backdropDue = (t) => t.backdrop_checked_at == null;

// évadok: sorozat TMDB-azonosítóval, még nem vagy 7 napnál régebben ellenőrizve
export const seasonsDue = (t, now = Date.now()) =>
  t.media_type === 'tv' && t.tmdb_id != null && olderThan(t.seasons_checked_at, SEASONS_REFRESH_DAYS, now);

// megjelenési dátumok: meg nem nézett film, tavalyi / idei / jövőbeli (vagy év nélküli), 3 napja nem
// néztük, és a digitális megjelenése nem régebbi 30 napnál (utána már nem változik)
export function releaseDue(t, today = budapestToday(), now = Date.now()) {
  if (t.media_type !== 'movie' || t.status === 'watched') return false;
  const year = Number(today.slice(0, 4));
  if (t.release_year != null && t.release_year < year - 1) return false;
  if (t.digital_release && t.digital_release <= addDays(today, -30)) return false;
  return olderThan(t.release_checked_at, RELEASE_RECHECK_DAYS, now);
}
