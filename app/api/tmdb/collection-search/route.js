import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse } from '@/lib/server/tmdb';

const LIMIT = 8;

// GET /api/tmdb/collection-search?q=csillagok
// TMDB-gyűjtemények keresése (a franchise-hoz kézzel hozzárendeléshez).
// Válasz: { results: [{ id, name, poster_path }] }
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return Response.json({ error: 'Írj be legalább 2 karaktert.' }, { status: 400 });
  }
  try {
    const data = await tmdbFetch('/search/collection', { query: q, language: 'hu-HU' });
    const results = (data.results ?? [])
      .filter((c) => !c.adult)
      .slice(0, LIMIT)
      .map((c) => ({ id: c.id, name: c.name, poster_path: c.poster_path ?? null }));
    return Response.json({ results });
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
