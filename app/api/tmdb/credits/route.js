import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbErrorResponse, cachedResponse, DAY_S, titleParams } from '@/lib/server/tmdb';
import { loadCredits } from '@/lib/server/credits';

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
    return cachedResponse(await loadCredits(type, id), DAY_S);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
