import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import {
  tmdbFetch,
  tmdbErrorResponse,
  yearOf,
  cached,
  cachedResponse,
  DAY_S,
  ANIMATION_GENRE,
} from '@/lib/server/tmdb';

// dokumentumfilm, hírek, valóságshow, szappanopera, talkshow, animáció – ezek a színész „további”
// címei közül kimaradnak (Norbi döntése, terv-3 61; a Felfedezés szűrésének mintájára)
const MINOR_GENRES = new Set([99, 10763, 10764, 10766, 10767, ANIMATION_GENRE]);
const GUEST_EPISODES = 2; // sorozatban legfeljebb ennyi rész: vendégszereplés
const SELF = /^(self|himself|herself|themselves|önmaga)\b/i; // önmagát alakítja (gála, interjú)
const MAX_CREDITS = 400;

// GET /api/tmdb/person?id=1190668
// Egy színész lapja az adatlapon belül (terv-3 61): adatai és a szerepei (filmek és sorozatok),
// címenként egyszer, a szerepnevekkel. A „minor” jelű szerepet (borító nélkül, animáció /
// dokumentum / talkshow…, vendégszereplés, önmaga) a kliens csak akkor mutatja, ha a cím a listán
// van. Az életrajz magyarul, ha nincs, angolul (bio_lang). Egy napig gyorsítótárazva; ha a személy
// nincs a TMDB-n: { person: null, credits: [] }.
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ error: 'Hibás kérés: az id pozitív egész szám legyen.' }, { status: 400 });
  }

  try {
    const body = await cached(`person:${id}`, DAY_S * 1000, () => loadPerson(id));
    return cachedResponse(body, DAY_S);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}

async function loadPerson(id) {
  let data;
  try {
    data = await tmdbFetch(`/person/${id}`, { language: 'hu-HU', append_to_response: 'combined_credits' });
  } catch (err) {
    if (err.status === 404) return { person: null, credits: [] };
    throw err;
  }
  let biography = data.biography?.trim() ?? '';
  let bioLang = 'hu';
  if (!biography) {
    const en = await tmdbFetch(`/person/${id}`, { language: 'en-US' }).catch(() => null);
    biography = en?.biography?.trim() ?? '';
    bioLang = 'en';
  }

  const credits = new Map(); // media_type:id → szerep (egy cím többször is szerepelhet)
  for (const c of data.combined_credits?.cast ?? []) {
    if ((c.media_type !== 'movie' && c.media_type !== 'tv') || c.adult) continue;
    const key = `${c.media_type}:${c.id}`;
    const character = c.character?.trim() ?? '';
    const prev = credits.get(key);
    if (prev) {
      if (character && !prev.character.split(' / ').includes(character)) {
        prev.character = prev.character ? `${prev.character} / ${character}` : character;
      }
      prev.episode_count = (prev.episode_count ?? 0) + (c.episode_count ?? 0) || null;
      continue;
    }
    credits.set(key, {
      media_type: c.media_type,
      tmdb_id: c.id,
      title: c.title ?? c.name,
      original_title: c.original_title ?? c.original_name,
      release_year: yearOf(c.release_date ?? c.first_air_date),
      release_date: (c.release_date ?? c.first_air_date) || null,
      poster_path: c.poster_path ?? null,
      character,
      episode_count: c.media_type === 'tv' ? (c.episode_count ?? null) : null,
      votes: c.vote_count ?? 0,
      genre_ids: c.genre_ids ?? [],
    });
  }

  const list = [...credits.values()]
    .map(({ genre_ids, ...c }) => ({
      ...c,
      minor:
        !c.poster_path ||
        genre_ids.some((g) => MINOR_GENRES.has(g)) ||
        (c.media_type === 'tv' && (c.episode_count ?? 0) <= GUEST_EPISODES) ||
        SELF.test(c.character),
    }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, MAX_CREDITS);

  return {
    person: {
      id: data.id,
      name: data.name,
      profile_path: data.profile_path ?? null,
      birthday: data.birthday || null,
      deathday: data.deathday || null,
      place_of_birth: data.place_of_birth || null,
      biography,
      bio_lang: biography ? bioLang : null,
    },
    credits: list,
  };
}
