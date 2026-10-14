import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse, cached, pickCast, cachedResponse, DAY_S } from '@/lib/server/tmdb';

const DAY = 24 * 60 * 60 * 1000;

// GET /api/tmdb/credits?type=movie&id=693134
// Szereplők az adatlapon (terv-3 38, Norbi döntése, 2026-10-06; a 91-es óta legfeljebb 20 – az adatlap az első 3-at
// mutatja, a többit kibontva): a top cast – filmnél
// a credits, sorozatnál az aggregate_credits (az összes évad) sorrendjében; rendező nincs. Egy napig
// gyorsítótárazva. Ha a cím már nincs a TMDB-n, üres lista.
// Válasz: { cast: [{ id, name, character, profile_path }] }.
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
    // (a kulcs a 91-es óta más: a korábbi, 3 fős lista ne jöjjön a memóriából)
    const cast = await cached(`credits20:${type}:${id}`, DAY, async () => {
      try {
        const path = type === 'movie' ? `/movie/${id}/credits` : `/tv/${id}/aggregate_credits`;
        return pickCast(await tmdbFetch(path, { language: 'hu-HU' }));
      } catch (err) {
        if (err.status === 404) return [];
        throw err;
      }
    });
    return cachedResponse({ cast }, DAY_S);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
