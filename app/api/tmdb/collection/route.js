import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { cached, tmdbFetch, tmdbErrorResponse, cachedResponse, DAY_S } from '@/lib/server/tmdb';
import { loadCollection } from '@/lib/server/collections';

const DAY = 24 * 60 * 60 * 1000;
const MAX_MOVIES = 60; // ennyi filmnél nézzük meg, melyik TMDB-gyűjteménybe tartozik
const MAX_COLLECTIONS = 15;

const ids = (value) =>
  (value ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);

// GET /api/tmdb/collection?movies=76341,786892&extra=10
// Egy franchise TMDB-gyűjteményei: a filmjei (TMDB film-azonosítók) mind, amelyik gyűjteménybe
// tartozik, plusz a kézzel hozzárendeltek (extra). A gyűjtemények a legkorábbi részük szerint
// sorban. Válasz: { collections: [{ id, name, backdrop_path, parts }] } (üres, ha nincs).
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const params = new URL(request.url).searchParams;
  const movies = ids(params.get('movies')).slice(0, MAX_MOVIES);
  const extra = ids(params.get('extra'));
  if (movies.length === 0 && extra.length === 0) {
    return Response.json(
      { error: 'Hibás kérés: a movies vagy az extra legyen vesszővel elválasztott TMDB-azonosítók listája.' },
      { status: 400 }
    );
  }

  try {
    // melyik gyűjteménybe tartoznak a filmek (filmenként egy napig tárolva), tízesével
    const found = [];
    for (let i = 0; i < movies.length; i += 10) {
      const batch = await Promise.all(
        movies.slice(i, i + 10).map((id) =>
          cached(`movie-collection:${id}`, DAY, async () => {
            const d = await tmdbFetch(`/movie/${id}`, { language: 'hu-HU' });
            return d.belongs_to_collection?.id ?? null;
          }).catch(() => null)
        )
      );
      found.push(...batch);
    }
    const unique = [...new Set([...found.filter(Boolean), ...extra])].slice(0, MAX_COLLECTIONS);
    const collections = (await Promise.all(unique.map((id) => loadCollection(id).catch(() => null))))
      .filter((c) => c && c.parts.length > 0)
      .sort((a, b) => (a.parts[0].release_date || '9999').localeCompare(b.parts[0].release_date || '9999'));
    return cachedResponse({ collections }, DAY_S);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
