import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse, cached, cachedResponse, DAY_S } from '@/lib/server/tmdb';

const DAY = DAY_S * 1000;

// a legjobb előzetes: YouTube-on, előbb a hivatalos, előbb a „Trailer” (aztán „Teaser”), a legfrissebb
function pickTrailer(videos) {
  const score = (v) => (v.type === 'Trailer' ? 2 : v.type === 'Teaser' ? 1 : 0) * 2 + (v.official ? 1 : 0);
  return (
    videos
      .filter((v) => v.site === 'YouTube' && v.key && (v.type === 'Trailer' || v.type === 'Teaser'))
      .sort((a, b) => score(b) - score(a) || (b.published_at ?? '').localeCompare(a.published_at ?? ''))[0] ??
    null
  );
}

// GET /api/tmdb/videos?type=movie&id=693134
// A cím előzetese a TMDB-ről: előbb a magyar nyelvű (szinkron vagy felirat), ha nincs, az angol.
// Válasz: { video: { key, name, lang } } vagy { video: null }.
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
    const video = await cached(`videos:${type}:${id}`, DAY, async () => {
      try {
        for (const language of ['hu-HU', 'en-US']) {
          const data = await tmdbFetch(`/${type}/${id}/videos`, { language });
          const v = pickTrailer(data.results ?? []);
          if (v) return { key: v.key, name: v.name, lang: v.iso_639_1 };
        }
      } catch (err) {
        if (err.status !== 404) throw err; // a TMDB-n már nincs meg: nincs előzetes
      }
      return null;
    });
    return cachedResponse({ video }, DAY_S);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
