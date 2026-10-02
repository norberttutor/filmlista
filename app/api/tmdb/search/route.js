import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse, yearOf } from '@/lib/server/tmdb';

// GET /api/tmdb/search?q=dűne
// Filmek és sorozatok keresése; a válasz mezőnevei a titles tábla oszlopai.
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) return Response.json({ results: [] });

  let data;
  try {
    data = await tmdbFetch('/search/multi', {
      query,
      language: 'hu-HU',
      include_adult: 'false',
    });
  } catch (err) {
    return tmdbErrorResponse(err);
  }

  // a search/multi személyeket is visszaad, azokat kihagyjuk
  const results = data.results
    .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
    .map((r) => ({
      media_type: r.media_type,
      tmdb_id: r.id,
      title: r.title ?? r.name,
      original_title: r.original_title ?? r.original_name,
      release_year: yearOf(r.release_date ?? r.first_air_date),
      poster_path: r.poster_path,
    }));

  return Response.json({ results });
}
