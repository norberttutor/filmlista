import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse, cached, cachedResponse, DAY_S, titleParams } from '@/lib/server/tmdb';

const DAY = DAY_S * 1000;
const MAX = 8;

// a jelenetképek: előbb a felirat nélküliek (nyelv nélküli kép), ha kevés, az angolok; azon belül a legjobb
// szavazatúak (az egyformák közül a több szavazatú)
function pickBackdrops(images) {
  const score = (b) => b.vote_average * 1000 + (b.vote_count ?? 0);
  const plain = images.filter((b) => b.iso_639_1 == null);
  const english = images.filter((b) => b.iso_639_1 === 'en');
  const sorted = [...plain.sort((a, b) => score(b) - score(a)), ...english.sort((a, b) => score(b) - score(a))];
  return sorted.map((b) => b.file_path).filter(Boolean).slice(0, MAX);
}

// GET /api/tmdb/images?type=movie&id=693134
// Képgaléria az adatlapon (terv-3 95, 2026-10-14): a cím jelenetképei a TMDB-ről, legfeljebb 8.
// Válasz: { images: ['/abc.jpg', …] } (a TMDB-n már nem létező címnél üres).
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const { type, id, bad } = titleParams(request);
  if (bad) return bad;

  try {
    const images = await cached(`images:${type}:${id}`, DAY, async () => {
      try {
        const data = await tmdbFetch(`/${type}/${id}/images`, { include_image_language: 'null,en' });
        return pickBackdrops(data.backdrops ?? []);
      } catch (err) {
        if (err.status !== 404) throw err; // a TMDB-n már nincs meg: nincs kép
        return [];
      }
    });
    return cachedResponse({ images }, DAY_S);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
