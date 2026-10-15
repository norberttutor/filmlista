import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse, cached, cachedResponse, DAY_S } from '@/lib/server/tmdb';

const DAY = DAY_S * 1000;
const MAX = 4;

// a cím logói: előbb az angolok, aztán a nyelv nélküliek, a magyarok; azon belül a jobb szavazatúak. A nagyon
// elnyúlt (6:1-nél szélesebb – rendszerint hosszú alcímes) és az álló logók a végére kerülnek.
function pickLogos(logos) {
  const lang = (l) => (l.iso_639_1 === 'en' ? 3 : l.iso_639_1 == null ? 2 : l.iso_639_1 === 'hu' ? 1 : 0);
  const compact = (l) => (l.aspect_ratio >= 1 && l.aspect_ratio <= 6 ? 1 : 0);
  return [...logos]
    .filter((l) => l.file_path && lang(l) > 0)
    .sort((a, b) => compact(b) - compact(a) || lang(b) - lang(a) || b.vote_average - a.vote_average)
    .slice(0, MAX)
    .map((l) => ({ path: l.file_path, lang: l.iso_639_1 ?? null }));
}

// GET /api/tmdb/logos?type=movie&id=120
// A franchise-logó kézi választásához (átnézés J8, 2026-10-15): a cím címlogói a TMDB-ről, legfeljebb 4.
// Válasz: { logos: [{ path, lang }] } (a TMDB-n már nem létező címnél üres).
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
    const logos = await cached(`logos:${type}:${id}`, DAY, async () => {
      try {
        const data = await tmdbFetch(`/${type}/${id}/images`, { include_image_language: 'en,null,hu' });
        return pickLogos(data.logos ?? []);
      } catch (err) {
        if (err.status !== 404) throw err; // a TMDB-n már nincs meg: nincs logó
        return [];
      }
    });
    return cachedResponse({ logos }, DAY_S);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
