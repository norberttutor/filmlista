import 'server-only';
import { tmdbFetch, yearOf, cached, ANIMATION_GENRE } from '@/lib/server/tmdb';

// Egy személy (színész / rendező) adatai és filmjei (terv-3 61, M4) – a /api/tmdb/person és a
// követett személyek háttérellenőrzése (/api/people/refresh) közös forrása.

// dokumentumfilm, hírek, valóságshow, szappanopera, talkshow, animáció – ezek a színész „további”
// címei közül kimaradnak (Norbi döntése, terv-3 61; a Felfedezés szűrésének mintájára)
const MINOR_GENRES = new Set([99, 10763, 10764, 10766, 10767, ANIMATION_GENRE]);
const GUEST_EPISODES = 2; // sorozatban legfeljebb ennyi rész: vendégszereplés
const SELF = /^(self|himself|herself|themselves|önmaga)\b/i; // önmagát alakítja (gála, interjú)
const MAX_CREDITS = 400;
// főszerep (M4, Norbi döntése, 2026-10-17): filmben a stáblista első 3 helye (order 0–2), sorozatban
// legalább 6 rész (a TMDB a sorozatoknál nem ad stáblista-sorrendet); rendezőnél minden rendezett film
const LEAD_ORDER = 2;
const LEAD_EPISODES = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

export const ROLES = ['actor', 'director'];

// role: 'actor' – a színészi szerepek (filmek és sorozatok); 'director' – a rendezett filmek.
// Visszaad: { person, credits: [{ media_type, tmdb_id, title, …, lead, minor }] } (ismertség
// szerint); ha a személy nincs a TMDB-n: { person: null, credits: [] }. Egy napig gyorsítótárazva.
export function loadPerson(id, role = 'actor') {
  return cached(`person:${role}:${id}`, DAY_MS, () => fetchPerson(id, role));
}

async function fetchPerson(id, role) {
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

  const director = role === 'director';
  const source = director
    ? (data.combined_credits?.crew ?? []).filter((c) => c.job === 'Director' && c.media_type === 'movie')
    : (data.combined_credits?.cast ?? []);

  const credits = new Map(); // media_type:id → szerep (egy cím többször is szerepelhet)
  for (const c of source) {
    if ((c.media_type !== 'movie' && c.media_type !== 'tv') || c.adult) continue;
    const key = `${c.media_type}:${c.id}`;
    const character = director ? '' : (c.character?.trim() ?? '');
    const order = c.media_type === 'movie' && !director ? (c.order ?? null) : null;
    const prev = credits.get(key);
    if (prev) {
      if (character && !prev.character.split(' / ').includes(character)) {
        prev.character = prev.character ? `${prev.character} / ${character}` : character;
      }
      prev.episode_count = (prev.episode_count ?? 0) + (c.episode_count ?? 0) || null;
      if (order != null && (prev.order == null || order < prev.order)) prev.order = order;
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
      order,
      episode_count: c.media_type === 'tv' ? (c.episode_count ?? null) : null,
      votes: c.vote_count ?? 0,
      genre_ids: c.genre_ids ?? [],
    });
  }

  const list = [...credits.values()]
    .map(({ genre_ids, order, ...c }) => ({
      ...c,
      lead:
        director ||
        (c.media_type === 'movie' ? order != null && order <= LEAD_ORDER : (c.episode_count ?? 0) >= LEAD_EPISODES),
      minor:
        !c.poster_path ||
        genre_ids.some((g) => MINOR_GENRES.has(g)) ||
        (c.media_type === 'tv' && (c.episode_count ?? 0) <= GUEST_EPISODES) ||
        SELF.test(c.character),
      // a háttérellenőrzésnek (a borító hiánya ott nem számít: a bejelentett filmnek gyakran még nincs)
      minor_genre: genre_ids.some((g) => MINOR_GENRES.has(g)) || SELF.test(c.character),
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
