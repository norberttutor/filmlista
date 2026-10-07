import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbErrorResponse, cachedResponse, HOUR_S } from '@/lib/server/tmdb';
import { DISCOVER_LISTS, discoverList } from '@/lib/server/discover';

// GET /api/tmdb/discover?list=cinema|upcoming|digital|tv
// A „Cím hozzáadása” panel felfedező sorai (üres keresőnél). Egy óráig gyorsítótárazva.
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const name = new URL(request.url).searchParams.get('list');
  if (!DISCOVER_LISTS.includes(name)) {
    return Response.json(
      { error: 'Hibás kérés: a list értéke cinema, upcoming, digital vagy tv legyen.' },
      { status: 400 }
    );
  }
  try {
    const results = await discoverList(name);
    return cachedResponse({ results }, HOUR_S);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
