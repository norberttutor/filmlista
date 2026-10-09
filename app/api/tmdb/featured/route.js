import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import {
  cached,
  tmdbFetch,
  tmdbErrorResponse,
  cachedResponse,
  pickLogo,
  pickReleaseDates,
  HOUR_S,
} from '@/lib/server/tmdb';
import { discoverList } from '@/lib/server/discover';

const HOUR = 60 * 60 * 1000;
// ennyi jelöltet készítünk elő: a sávban 6 látszik, az elrejtettek („Nem érdekel”) helyére a
// következő lép (a szűrés a böngészőben van)
const CANDIDATES = 10;

// a cím logója: magyar, ha van (kompakt arányú), különben a közös szabály (angol / nyelv nélküli)
function logoOf(logos = []) {
  const hu = logos.filter((l) => l.iso_639_1 === 'hu' && l.aspect_ratio >= 1 && l.aspect_ratio <= 6);
  if (hu.length) return [...hu].sort((a, b) => b.vote_average - a.vote_average)[0].file_path;
  return pickLogo(logos);
}

// { results, complete }: complete = minden részlet lejött (a 404 – már nincs a TMDB-n – nem hiba);
// a hiányosat sem a szerver, sem a böngésző nem tárolja (kódaudit #5)
async function loadFeatured() {
  const list = (await discoverList('cinema')).slice(0, CANDIDATES);
  let complete = true;
  const details = await Promise.all(
    list.map((r) =>
      tmdbFetch(`/movie/${r.tmdb_id}`, {
        language: 'hu-HU',
        append_to_response: 'images,release_dates',
        include_image_language: 'hu,en,null',
      }).catch((err) => {
        if (err.status !== 404) complete = false;
        return null;
      })
    )
  );
  const results = list
    .map((r, i) => {
      const d = details[i];
      if (!d?.backdrop_path) return null;
      return {
        ...r,
        backdrop_path: d.backdrop_path,
        overview: d.overview || null,
        genres: (d.genres ?? []).slice(0, 2).map((g) => g.name),
        runtime: d.runtime || null,
        cinema_date: pickReleaseDates(d.release_dates?.results).theatrical_release,
        logo_path: logoOf(d.images?.logos),
      };
    })
    .filter(Boolean);
  return { results, complete };
}

// GET /api/tmdb/featured
// Kiemelt sáv a Felfedezés tetején (terv-3 46, Norbi választása: „A” látványterv): a „Most a
// mozikban” lista első címei széles jelenetképpel, logóval, leírással, műfajjal, játékidővel és a
// mozis bemutató napjával. Egy óráig gyorsítótárazva (a szerveren és a böngészőben is) – ha
// valamelyik részlet nem jött le, a hiányos listát egyik sem tárolja.
// Válasz: { results: [{ media_type, tmdb_id, title, …, backdrop_path, overview, genres, runtime,
// cinema_date, logo_path }] }
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();
  try {
    const day = new Date().toISOString().slice(0, 10);
    const { results, complete } = await cached(`featured:${day}`, HOUR, loadFeatured, (v) => v.complete);
    return complete ? cachedResponse({ results }, HOUR_S) : Response.json({ results });
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
