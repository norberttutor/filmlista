import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse, cached, pickProviders, cachedResponse, DAY_S } from '@/lib/server/tmdb';

const DAY = 24 * 60 * 60 * 1000;

// GET /api/tmdb/providers?type=movie&id=438631
// „Hol nézhető?” – a cím magyarországi előfizetéses és ingyenes streamingszolgáltatói (TMDB,
// az adatok forrása a JustWatch). Egy napig gyorsítótárazva. Ha a cím már nincs a TMDB-n,
// üres lista. Válasz: { providers: [{ id, name, logo, free }] }.
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

  try {
    const providers = await cached(`providers:${type}:${id}`, DAY, async () => {
      try {
        const data = await tmdbFetch(`/${type}/${id}/watch/providers`);
        return pickProviders(data.results);
      } catch (err) {
        if (err.status === 404) return [];
        throw err;
      }
    });
    return cachedResponse({ providers }, DAY_S);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
