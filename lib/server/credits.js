import 'server-only';
import { tmdbFetch, cached, pickCast, pickDirectors } from '@/lib/server/tmdb';

const DAY = 24 * 60 * 60 * 1000;

// Egy cím szereplői és (filmnél) rendezői – a /api/tmdb/credits és a követési javaslat
// (/api/people/suggest, terv-3 111) közös forrása, egy napig gyorsítótárazva. Filmnél a credits,
// sorozatnál az aggregate_credits (az összes évad) sorrendjében. Ha a cím már nincs a TMDB-n, üres.
// Visszaad: { cast: [{ id, name, character, profile_path }], directors: [{ id, name, profile_path }] }
export function loadCredits(type, id) {
  // (a kulcs az M4 óta más: a korábbi, rendező nélküli válasz ne jöjjön a memóriából)
  return cached(`credits-dir:${type}:${id}`, DAY, async () => {
    try {
      const path = type === 'movie' ? `/movie/${id}/credits` : `/tv/${id}/aggregate_credits`;
      const data = await tmdbFetch(path, { language: 'hu-HU' });
      return { cast: pickCast(data), directors: type === 'movie' ? pickDirectors(data) : [] };
    } catch (err) {
      if (err.status === 404) return { cast: [], directors: [] };
      throw err;
    }
  });
}
