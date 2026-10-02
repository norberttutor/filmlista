import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse, yearOf } from '@/lib/server/tmdb';
import { omdbEnabled, fetchImdbRating } from '@/lib/server/omdb';

// IMDb-értékelés az OMDb-ből; ha nem sikerül, a cím attól még felvehető,
// a hiányzó értékelést a /api/imdb/refresh később pótolja.
async function imdbFields(imdbId) {
  if (!imdbId || !omdbEnabled()) return {};
  try {
    const rating = await fetchImdbRating(imdbId);
    return { ...rating, imdb_rating_updated_at: new Date().toISOString() };
  } catch (err) {
    console.error(err);
    return {};
  }
}

// Ha nincs magyar leírás, az angolt használjuk – az is jobb a semminél.
function pickOverview(data) {
  if (data.overview) return data.overview;
  const english = data.translations?.translations?.find((t) => t.iso_639_1 === 'en');
  return english?.data?.overview || null;
}

// GET /api/tmdb/details?type=movie&id=438631
// Egy film/sorozat adatai a titles táblába illeszthető formában, plusz a műfajai.
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const params = new URL(request.url).searchParams;
  const type = params.get('type');
  const id = Number(params.get('id'));
  if ((type !== 'movie' && type !== 'tv') || !Number.isInteger(id) || id <= 0) {
    return Response.json(
      { error: 'Hibás kérés: a type legyen movie vagy tv, az id pozitív egész szám.' },
      { status: 400 }
    );
  }

  let data;
  try {
    data = await tmdbFetch(`/${type}/${id}`, {
      language: 'hu-HU',
      append_to_response: 'external_ids,translations',
    });
  } catch (err) {
    return tmdbErrorResponse(err);
  }

  // a TMDB néha üres szöveget ad IMDb ID helyett; az adatbázis csak tt1234567 formát fogad el
  const rawImdbId = data.external_ids?.imdb_id;
  const imdbId = /^tt\d+$/.test(rawImdbId ?? '') ? rawImdbId : null;

  return Response.json({
    media_type: type,
    tmdb_id: data.id,
    title: data.title ?? data.name,
    original_title: data.original_title ?? data.original_name,
    release_year: yearOf(data.release_date ?? data.first_air_date),
    overview: pickOverview(data),
    poster_path: data.poster_path,
    imdb_id: imdbId,
    ...(await imdbFields(imdbId)),
    genres: (data.genres ?? []).map(({ id, name }) => ({ id, name })),
  });
}
