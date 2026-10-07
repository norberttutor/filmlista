import { cached, tmdbFetch, yearOf } from '@/lib/server/tmdb';

// A Felfedezés listái (`/api/tmdb/discover`) és a kiemelt sáv (`/api/tmdb/featured`, terv-3 46) közös
// betöltője – csak route handlerben.

const LIMIT = 16; // ennyi cím egy sorban
const HOUR = 60 * 60 * 1000;
// Norbit csak a magyar szinkronos címek érdeklik. A TMDB nem tárolja, van-e szinkron, ezért
// közelítünk: Magyarországon megjelent (filmnél) / magyar streamingen elérhető (sorozatnál), és
// angol vagy magyar eredeti nyelvű – ezek túlnyomó része szinkronos.
const LANGUAGES = new Set(['en', 'hu']);
// dokumentumfilm, valóságshow, talkshow, hírek, szappanopera – ezek ritkán szinkronosak
const SKIP_GENRES = new Set([99, 10763, 10764, 10766, 10767]);

const day = (offset) => new Date(Date.now() + offset * 864e5).toISOString().slice(0, 10);

// a listák: TMDB discover, magyar régióval
const LISTS = {
  // a mozikban az utóbbi hónapokban bemutatott, most népszerű filmek
  cinema: () => ({
    path: '/discover/movie',
    params: {
      region: 'HU',
      with_release_type: '2|3',
      'release_date.gte': day(-150),
      'release_date.lte': day(0),
      sort_by: 'popularity.desc',
    },
    type: 'movie',
  }),
  // a következő három hónapban érkező mozifilmek
  upcoming: () => ({
    path: '/discover/movie',
    params: {
      region: 'HU',
      with_release_type: '2|3',
      'release_date.gte': day(1),
      'release_date.lte': day(90),
      sort_by: 'popularity.desc',
    },
    type: 'movie',
  }),
  // az utóbbi hetekben digitálisan (letölthetően / streamelhetően) megjelent filmek
  digital: () => ({
    path: '/discover/movie',
    params: {
      region: 'HU',
      with_release_type: '4',
      'release_date.gte': day(-60),
      'release_date.lte': day(0),
      sort_by: 'popularity.desc',
    },
    type: 'movie',
  }),
  // magyar előfizetéses streamingen elérhető, mostanában futó (új részt kapott) sorozatok
  tv: () => ({
    path: '/discover/tv',
    params: {
      watch_region: 'HU',
      with_watch_monetization_types: 'flatrate',
      'air_date.gte': day(-90),
      'air_date.lte': day(0),
      sort_by: 'popularity.desc',
    },
    type: 'tv',
  }),
};

// a lista első LIMIT címe (TMDB, magyar régióval, a szinkron-közelítés szűrőivel)
async function loadList(name) {
  const { path, params, type } = LISTS[name]();
  const results = [];
  for (let page = 1; page <= 5 && results.length < LIMIT; page++) {
    const data = await tmdbFetch(path, { language: 'hu-HU', ...params, page: String(page) });
    for (const r of data.results ?? []) {
      // magyar leírás nélkül (nincs magyar fordítása) a szinkron is valószínűtlen
      if (r.adult || !r.poster_path || !r.overview || !LANGUAGES.has(r.original_language)) continue;
      if ((r.genre_ids ?? []).some((g) => SKIP_GENRES.has(g))) continue;
      results.push({
        media_type: type,
        tmdb_id: r.id,
        title: r.title ?? r.name,
        original_title: r.original_title ?? r.original_name,
        release_year: yearOf(r.release_date ?? r.first_air_date),
        release_date: r.release_date ?? r.first_air_date ?? null,
        poster_path: r.poster_path,
      });
    }
    if (page >= (data.total_pages ?? 1)) break;
  }
  return results.slice(0, LIMIT);
}

export const DISCOVER_LISTS = Object.keys(LISTS);

// a lista címei – naponta új kulccsal, egy óráig a szerverpéldány memóriájában
export function discoverList(name) {
  return cached(`discover:${name}:${day(0)}`, HOUR, () => loadList(name));
}
