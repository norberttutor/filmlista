import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse, yearOf, cachedResponse } from '@/lib/server/tmdb';

const MAX_PEOPLE = 6;
const KNOWN_FOR = 3; // a személy ismert munkáiból ennyi cím

// GET /api/tmdb/search?q=dűne
// Filmek és sorozatok keresése; a válasz mezőnevei a titles tábla oszlopai. Színészek és rendezők is
// (terv-3 110): people – { person_id, name, profile_path, role ('actor' | 'director'), known_for: [cím] };
// peopleFirst: a TMDB a személyt tette az első helyre (pl. „tom hanks”), a felület ilyenkor őket mutatja elöl.
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) return Response.json({ results: [], people: [], peopleFirst: false });

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

  // csak színészek és rendezők (a többi stábtag lapja nem nyitható)
  const isPerson = (r) =>
    r.media_type === 'person' && (r.known_for_department === 'Acting' || r.known_for_department === 'Directing');
  const people = data.results
    .filter(isPerson)
    .slice(0, MAX_PEOPLE)
    .map((r) => ({
      person_id: r.id,
      name: r.name,
      profile_path: r.profile_path ?? null,
      role: r.known_for_department === 'Directing' ? 'director' : 'actor',
      known_for: (r.known_for ?? [])
        .filter((k) => k.media_type === 'movie' || k.media_type === 'tv')
        .slice(0, KNOWN_FOR)
        .map((k) => k.title ?? k.name),
    }));
  const peopleFirst = people.length > 0 && isPerson(data.results[0]);

  return cachedResponse({ results, people, peopleFirst }, 10 * 60); // 10 perc
}
