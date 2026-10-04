import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse, cached, yearOf } from '@/lib/server/tmdb';

const DAY = 24 * 60 * 60 * 1000;

// GET /api/tmdb/find?imdb=tt1160419
// IMDb-azonosító → TMDB film vagy sorozat (az IMDb-figyelőlista importjához), magyar címmel.
// Válasz: { result: { media_type, tmdb_id, title, original_title, release_year, poster_path } }
// vagy { result: null }, ha a TMDB nem ismeri (vagy nem film / sorozat, pl. epizód).
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const imdb = new URL(request.url).searchParams.get('imdb') ?? '';
  if (!/^tt\d{5,10}$/.test(imdb)) {
    return Response.json({ error: 'Hibás kérés: az imdb paraméter egy IMDb-azonosító (tt…).' }, { status: 400 });
  }

  try {
    const result = await cached(`find:${imdb}`, DAY, async () => {
      const data = await tmdbFetch(`/find/${imdb}`, { external_source: 'imdb_id', language: 'hu-HU' });
      const movie = data.movie_results?.[0];
      if (movie) {
        return {
          media_type: 'movie',
          tmdb_id: movie.id,
          title: movie.title,
          original_title: movie.original_title,
          release_year: yearOf(movie.release_date),
          poster_path: movie.poster_path,
        };
      }
      const tv = data.tv_results?.[0];
      if (tv) {
        return {
          media_type: 'tv',
          tmdb_id: tv.id,
          title: tv.name,
          original_title: tv.original_name,
          release_year: yearOf(tv.first_air_date),
          poster_path: tv.poster_path,
        };
      }
      return null;
    });
    return Response.json({ result });
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
