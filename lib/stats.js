// A statisztika ablak számai a betöltött listából (adatbázis-lekérdezés nélkül).
import { seasonAired, todayDate, DROPPED_STATUS } from '@/lib/titles';

const MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];

const average = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : null);

// ízlésprofil (terv-3 42): egy műfaj ennyi értékelt címtől számít (kevesebből félrevezető lenne)
export const TASTE_MIN = 3;
const TASTE_TOP = 5; // kedvenc műfajok
const TASTE_SIDE = 3; // eltérés: ennyi felfelé és ennyi lefelé

// a saját csillagok műfajonként: kedvencek (átlag szerint) és az eltérés az IMDb-től
// (saját − IMDb átlaga ugyanazokon a címeken); csak a TASTE_MIN-nél több értékelt címes műfajok
function tasteProfile(titles) {
  const byGenre = new Map(); // műfaj → { mine: [], diff: [] }
  for (const t of titles) {
    if (!t.my_rating) continue;
    for (const g of t.genres ?? []) {
      const e = byGenre.get(g) ?? { mine: [], diff: [] };
      e.mine.push(t.my_rating);
      if (t.imdb_rating != null) e.diff.push(t.my_rating - Number(t.imdb_rating));
      byGenre.set(g, e);
    }
  }
  const byName = (a, b) => a.genre.localeCompare(b.genre, 'hu');
  const favorites = [...byGenre]
    .filter(([, e]) => e.mine.length >= TASTE_MIN)
    .map(([genre, e]) => ({ genre, average: average(e.mine), count: e.mine.length }))
    .sort((a, b) => b.average - a.average || b.count - a.count || byName(a, b))
    .slice(0, TASTE_TOP);
  const deviations = [...byGenre]
    .filter(([, e]) => e.diff.length >= TASTE_MIN)
    .map(([genre, e]) => ({ genre, diff: average(e.diff), count: e.diff.length }));
  // a ±0,1-nél kisebb eltérés „ugyanaz” – nem kerül a listára
  const above = deviations.filter((d) => d.diff >= 0.1).sort((a, b) => b.diff - a.diff || byName(a, b)).slice(0, TASTE_SIDE);
  const below = deviations.filter((d) => d.diff <= -0.1).sort((a, b) => a.diff - b.diff || byName(a, b)).slice(0, TASTE_SIDE);
  return { favorites, above, below };
}

// titles: a titles_with_genres sorai; franchiseName: Map(id → név)
export function listStats(titles, franchiseName, today = todayDate()) {
  const counts = { total: titles.length, watched: 0 };
  for (const t of titles) {
    if (t.status === 'watched') counts.watched++;
  }

  // az utolsó 12 hónap (a mostanival együtt): hány cím lett megnézve (watched_at)
  const [y, m] = today.split('-').map(Number);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (11 - i), 1));
    const key = d.toISOString().slice(0, 7);
    return { key, label: MONTHS[d.getUTCMonth()], count: 0 };
  });
  const byMonth = new Map(months.map((mo) => [mo.key, mo]));
  for (const t of titles) {
    const mo = t.watched_at && byMonth.get(t.watched_at.slice(0, 7));
    if (mo) mo.count++;
  }
  const watchedLastYear = months.reduce((s, mo) => s + mo.count, 0);

  // műfajok (a legtöbbször előfordulók elöl)
  const genreCount = new Map();
  for (const t of titles) for (const g of t.genres ?? []) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
  const genres = [...genreCount].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'hu'));

  // értékelések
  const mine = titles.filter((t) => t.my_rating).map((t) => t.my_rating);
  const imdb = titles.filter((t) => t.imdb_rating != null).map((t) => Number(t.imdb_rating));
  const ratings = { mine: average(mine), mineCount: mine.length, imdb: average(imdb), imdbCount: imdb.length };

  // letöltve, de még nem látott (az abbahagyottak nélkül), a legutóbb hozzáadottak elöl
  const backlog = titles
    .filter((t) => t.is_downloaded && t.status !== 'watched' && t.status !== DROPPED_STATUS)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

  // franchise-ok (a legtöbb címmel)
  const frCount = new Map();
  for (const t of titles) {
    const name = t.franchise_id && franchiseName.get(t.franchise_id);
    if (name) frCount.set(name, (frCount.get(name) ?? 0) + 1);
  }
  const franchises = [...frCount].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'hu'));

  // folyamatban lévő sorozatok évadhaladása (a legelőrehaladottabbak elöl)
  const series = titles
    .filter((t) => t.media_type === 'tv' && t.status === 'watching' && t.seasons?.length)
    .map((t) => {
      const aired = t.seasons.filter((s) => seasonAired(s, today));
      return {
        id: t.id,
        title: t.title,
        aired: aired.length,
        watched: aired.filter((s) => s.status === 'watched').length,
        watching: aired.filter((s) => s.status === 'watching').length,
      };
    })
    .filter((s) => s.aired > 0)
    .sort((a, b) => b.watched / b.aired - a.watched / a.aired || a.title.localeCompare(b.title, 'hu'));

  return { counts, months, watchedLastYear, genres, ratings, backlog, franchises, series, taste: tasteProfile(titles) };
}

// tizedesvesszővel, egy tizedesre
export function formatDecimal(n) {
  return n == null ? '–' : n.toFixed(1).replace('.', ',');
}

// előjellel: „+0,8” / „−0,6” (tipográfiai mínuszjel)
export function formatSigned(n) {
  return (n > 0 ? '+' : '−') + formatDecimal(Math.abs(n));
}
