import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse, yearOf, cached, cachedResponse, DAY_S } from '@/lib/server/tmdb';

const LIMIT = 12; // ennyi ajánlás a szerkesztő ablakban
// csak a 2000-es vagy újabb, legalább 6,0-s TMDB-értékelésű (legalább 50 szavazatos) címek – Norbi
// kérése, 2026-10-07; filmre és sorozatra is (sorozatnál az első évad éve). A TMDB-értékelés az
// IMDb-é helyett: az a lista adataiban benne van, az IMDb-é címenként egy OMDb-kérés lenne
const MIN_YEAR = 2000;
const MIN_RATING = 6;
const MIN_VOTES = 50;
const MAX_PAGES = 2; // forrásonként ennyi oldalig pótol, ha a szűrés után kevés maradna

// GET /api/tmdb/similar?type=movie&id=438631
// A TMDB ajánlásai a címhez (a nézők alapján; ha kevés, a tartalmilag hasonlókkal pótolva),
// borítóval rendelkezők, a fenti szűréssel, legfeljebb 12. A válasz mezőnevei ugyanazok, mint a
// keresésé.
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
    const results = await cached(`similar2:${type}:${id}`, DAY_S * 1000, () => loadSimilar(type, id));
    return cachedResponse({ results }, DAY_S);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}

// megfelel-e a szűrésnek (film / sorozat, borítóval, nem maga a cím, elég új és elég jó)
function wanted(r, type, id) {
  const year = yearOf(r.release_date ?? r.first_air_date);
  return (
    (r.media_type === 'movie' || r.media_type === 'tv') &&
    !r.adult &&
    r.poster_path &&
    !(r.id === id && r.media_type === type) &&
    year >= MIN_YEAR &&
    (r.vote_average ?? 0) >= MIN_RATING &&
    (r.vote_count ?? 0) >= MIN_VOTES
  );
}

async function loadSimilar(type, id) {
  const found = new Map(); // media_type:id → TMDB-sor, a sorrend megmarad
  try {
    // előbb az ajánlások (a nézők alapján), ha kevés, a tartalmilag hasonlók – oldalanként
    for (const source of ['recommendations', 'similar']) {
      for (let page = 1; page <= MAX_PAGES && found.size < LIMIT; page++) {
        const data = await tmdbFetch(`/${type}/${id}/${source}`, { language: 'hu-HU', page: String(page) });
        // a "similar" válaszban nincs media_type: ugyanaz, mint a kiinduló címé
        for (const raw of data.results ?? []) {
          const r = { ...raw, media_type: raw.media_type ?? type };
          if (wanted(r, type, id)) found.set(`${r.media_type}:${r.id}`, r);
        }
        if (page >= (data.total_pages ?? 1)) break;
      }
      if (found.size >= LIMIT) break;
    }
  } catch (err) {
    if (err.status !== 404) throw err; // a cím már nincs meg a TMDB-n: nincs ajánlás (nem hiba)
  }

  return [...found.values()]
    .slice(0, LIMIT)
    .map((r) => ({
      media_type: r.media_type,
      tmdb_id: r.id,
      title: r.title ?? r.name,
      original_title: r.original_title ?? r.original_name,
      release_year: yearOf(r.release_date ?? r.first_air_date),
      poster_path: r.poster_path,
    }));
}
