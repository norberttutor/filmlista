import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse, yearOf, pickSeasons, pickReleaseDates, pickOverview, pickFacts, cached, cachedResponse, HOUR_S, titleParams } from '@/lib/server/tmdb';

const HOUR = HOUR_S * 1000;
import { omdbEnabled, fetchImdbRating } from '@/lib/server/omdb';

// IMDb-értékelés az OMDb-ből (1 óráig tárolva – az OMDb napi kerete véges; a hibás válasz nem
// tárolódik); ha nem sikerül, a cím attól még felvehető, a hiányzó értékelést a
// /api/imdb/refresh később pótolja. Hibánál null (a válasz ilyenkor nem tárolható).
async function imdbFields(imdbId) {
  if (!imdbId || !omdbEnabled()) return {};
  try {
    return await cached(`omdb:${imdbId}`, HOUR, async () => ({
      ...(await fetchImdbRating(imdbId)),
      imdb_rating_updated_at: new Date().toISOString(),
    }));
  } catch (err) {
    console.error(err);
    return null;
  }
}

// GET /api/tmdb/details?type=movie&id=438631
// Egy film/sorozat adatai a titles táblába illeszthető formában, plusz a műfajai;
// sorozatnál az évadai is (seasons: a title_seasons tábla oszlopaival).
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const { type, id, bad } = titleParams(request);
  if (bad) return bad;

  let title;
  try {
    title = await cached(`details:${type}:${id}`, HOUR, () => loadDetails(type, id));
  } catch (err) {
    return tmdbErrorResponse(err);
  }
  const imdb = await imdbFields(title.imdb_id);
  // OMDb-hibánál az értékelés nélküli válasz nem tárolódik (különben 1 óráig így jönne)
  if (!imdb) return Response.json(title);
  return cachedResponse({ ...title, ...imdb }, HOUR_S);
}

// a cím TMDB-adatai (az IMDb-érték nélkül; az időbélyegek a lekérdezéskoriak)
async function loadDetails(type, id) {
  const data = await tmdbFetch(`/${type}/${id}`, {
    language: 'hu-HU',
    append_to_response: type === 'movie' ? 'external_ids,translations,release_dates' : 'external_ids,translations',
  });

  // a TMDB néha üres szöveget ad IMDb ID helyett; az adatbázis csak tt1234567 formát fogad el
  const rawImdbId = data.external_ids?.imdb_id;
  const imdbId = /^tt\d+$/.test(rawImdbId ?? '') ? rawImdbId : null;

  return {
    media_type: type,
    tmdb_id: data.id,
    title: data.title ?? data.name,
    original_title: data.original_title ?? data.original_name,
    release_year: yearOf(data.release_date ?? data.first_air_date),
    // pontos dátum a megjelenés szerinti rendezéshez (terv-3 55; a TMDB üres szöveget is adhat)
    release_date: (data.release_date ?? data.first_air_date) || null,
    overview: pickOverview(data),
    poster_path: data.poster_path,
    // a szerkesztő ablak háttérképe (a felvétellel együtt mentődik; "megnézve", hogy a háttérben
    // ne kérdezzük újra)
    backdrop_path: data.backdrop_path ?? null,
    backdrop_checked_at: new Date().toISOString(),
    imdb_id: imdbId,
    genres: (data.genres ?? []).map(({ id, name }) => ({ id, name })),
    // játékidő, sorozatnál az állapota is (terv-3 125, 129)
    ...pickFacts(type, data),
    ...(type === 'tv' && { seasons: pickSeasons(data) }),
    // filmnél a mozis és a digitális megjelenés (a még meg nem jelent filmek jelvényéhez)
    ...(type === 'movie' && {
      ...pickReleaseDates(data.release_dates?.results),
      release_checked_at: new Date().toISOString(),
      // a TMDB-gyűjtemény (a franchise-javaslathoz, terv-3 35)
      tmdb_collection_id: data.belongs_to_collection?.id ?? null,
      collection_checked_at: new Date().toISOString(),
    }),
  };
}
