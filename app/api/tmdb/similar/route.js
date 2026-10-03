import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse, yearOf } from '@/lib/server/tmdb';

const LIMIT = 12; // ennyi ajánlás a szerkesztő ablakban

// GET /api/tmdb/similar?type=movie&id=438631
// A TMDB ajánlásai a címhez (a nézők alapján; ha nincs, a tartalmilag hasonlók), borítóval
// rendelkezők, legfeljebb 12. A válasz mezőnevei ugyanazok, mint a keresésé.
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

  let data;
  try {
    data = await tmdbFetch(`/${type}/${id}/recommendations`, { language: 'hu-HU' });
    if (!data.results?.length) {
      data = await tmdbFetch(`/${type}/${id}/similar`, { language: 'hu-HU' });
    }
  } catch (err) {
    return tmdbErrorResponse(err);
  }

  // a "similar" válaszban nincs media_type: ugyanaz, mint a kiinduló címé
  const results = (data.results ?? [])
    .map((r) => ({ ...r, media_type: r.media_type ?? type }))
    .filter(
      (r) =>
        (r.media_type === 'movie' || r.media_type === 'tv') &&
        !r.adult &&
        r.poster_path &&
        !(r.id === id && r.media_type === type)
    )
    .slice(0, LIMIT)
    .map((r) => ({
      media_type: r.media_type,
      tmdb_id: r.id,
      title: r.title ?? r.name,
      original_title: r.original_title ?? r.original_name,
      release_year: yearOf(r.release_date ?? r.first_air_date),
      poster_path: r.poster_path,
    }));

  return Response.json({ results });
}
