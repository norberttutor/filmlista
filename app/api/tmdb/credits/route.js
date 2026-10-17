import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse, cached, pickCast, pickDirectors, cachedResponse, DAY_S, titleParams } from '@/lib/server/tmdb';

const DAY = 24 * 60 * 60 * 1000;

// GET /api/tmdb/credits?type=movie&id=693134
// Szereplők az adatlapon (terv-3 38, Norbi döntése, 2026-10-06; a 91-es óta legfeljebb 20 – az adatlap az első 3-at
// mutatja, a többit kibontva): a top cast – filmnél
// a credits, sorozatnál az aggregate_credits (az összes évad) sorrendjében. Filmnél a rendező(k) is (M4: a
// nevére kattintva a lapja, követhető); sorozatnál nincs. Egy napig gyorsítótárazva. Ha a cím már nincs a
// TMDB-n, üres lista.
// Válasz: { cast: [{ id, name, character, profile_path }], directors: [{ id, name, profile_path }] }.
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const { type, id, bad } = titleParams(request);
  if (bad) return bad;

  try {
    // (a kulcs az M4 óta más: a korábbi, rendező nélküli válasz ne jöjjön a memóriából)
    const body = await cached(`credits-dir:${type}:${id}`, DAY, async () => {
      try {
        const path = type === 'movie' ? `/movie/${id}/credits` : `/tv/${id}/aggregate_credits`;
        const data = await tmdbFetch(path, { language: 'hu-HU' });
        return { cast: pickCast(data), directors: type === 'movie' ? pickDirectors(data) : [] };
      } catch (err) {
        if (err.status === 404) return { cast: [], directors: [] };
        throw err;
      }
    });
    return cachedResponse(body, DAY_S);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
