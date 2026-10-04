import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { cached, tmdbFetch, tmdbErrorResponse, yearOf } from '@/lib/server/tmdb';

const DAY = 24 * 60 * 60 * 1000;
const MAX_PROBES = 6; // ennyi filmnél nézzük meg, melyik TMDB-gyűjteménybe tartozik

// GET /api/tmdb/collection?movies=76341,786892
// Egy franchise filmjeinek (TMDB film-azonosítók) TMDB-gyűjteménye: a filmek közt leggyakoribb
// `belongs_to_collection`, az összes része megjelenési sorrendben, borítóval.
// Válasz: { collection: { id, name, backdrop_path, parts: [...] } } vagy { collection: null }.
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const ids = (new URL(request.url).searchParams.get('movies') ?? '')
    .split(',')
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) {
    return Response.json(
      { error: 'Hibás kérés: a movies legyen vesszővel elválasztott TMDB film-azonosítók listája.' },
      { status: 400 }
    );
  }

  try {
    // melyik gyűjteménybe tartoznak a filmek (egy napig tárolva filmenként)
    const counts = new Map();
    const probes = await Promise.all(
      ids.slice(0, MAX_PROBES).map((id) =>
        cached(`movie-collection:${id}`, DAY, async () => {
          const d = await tmdbFetch(`/movie/${id}`, { language: 'hu-HU' });
          return d.belongs_to_collection?.id ?? null;
        }).catch(() => null)
      )
    );
    for (const c of probes) if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    const best = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!best) return Response.json({ collection: null });

    const collection = await cached(`collection:${best}`, DAY, async () => {
      const c = await tmdbFetch(`/collection/${best}`, { language: 'hu-HU' });
      return {
        id: c.id,
        name: c.name,
        backdrop_path: c.backdrop_path ?? null,
        parts: (c.parts ?? [])
          .filter((p) => !p.adult)
          // a dátum nélküli (bejelentett) részek a végére
          .sort((a, b) => (a.release_date || '9999').localeCompare(b.release_date || '9999'))
          .map((p) => ({
            media_type: 'movie',
            tmdb_id: p.id,
            title: p.title,
            original_title: p.original_title,
            release_year: yearOf(p.release_date),
            release_date: p.release_date || null,
            poster_path: p.poster_path ?? null,
          })),
      };
    });
    return Response.json({ collection });
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
