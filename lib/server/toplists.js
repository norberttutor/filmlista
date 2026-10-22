import 'server-only'; // kliens-komponensből importálva a build hibát ad (kódaudit #45)
import { cached, tmdbFetch, yearOf } from '@/lib/server/tmdb';
import { fetchImdbRating, omdbEnabled } from '@/lib/server/omdb';

// A ⋮ „Toplisták” (terv-3 120): a legjobb filmek / sorozatok IMDb-értékelés szerint, csak a magyarul is
// megjelent címekből. Az IMDb Top 250 nem tölthető le (nincs API, a gépi olvasás tiltott), ezért:
//   1. jelöltek a TMDB-ről (a legjobbra értékelt és a legtöbb szavazatot kapott címek),
//   2. a magyar megjelenés közelítése (Norbi döntése, „laza” szabály – lent a huOk()),
//   3. a TMDB szerinti előrangsor legjobbjainak IMDb-értékelése (a közös imdb_ratings táblából, a saját
//      lista soraiból, vagy az OMDb-ről – naponta legfeljebb DAILY_OMDB kérés),
//   4. súlyozott sorrend, mint az IMDb Top 250-é: a kevés szavazatú cím az átlag felé húzódik.
// A kész lista a toplists táblába kerül (LIST_DAYS napig jó); a böngésző abból szűr műfajra / évtizedre.

export const TOPLIST_TYPES = ['movie', 'tv'];
export const TOPLIST_LISTS = ['all', 'recent', 'gems'];

const LIST_DAYS = 7; // a kész lista ennyi napig jó
const RATING_DAYS = 30; // egy IMDb-értékelés ennyi napig jó
const DAILY_OMDB = 400; // a toplisták napi OMDb-kerete (az OMDb ingyen napi 1000-et ad, az app saját frissítése is ebből él)
const KEEP = 250; // ennyi rangsorolt címet tárolunk (a műfaj- / évtizedszűrő ebből válogat, a böngésző 100-at mutat)
const DETAIL_PARALLEL = 8;
const OMDB_PARALLEL = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

// dokumentumfilm, hírek, valóságshow, szappanopera, talkshow – nem toplistára valók; az animáció marad
// (Norbi döntése: különben nem toplista – a Felfedezéstől eltérően)
const SKIP_GENRES = new Set([99, 10763, 10764, 10766, 10767]);
const MUSIC_GENRE = 10402; // csak „Zene” műfajú film: koncertfilm (a „Zene + Dráma” – pl. Whiplash – marad)

const budapestToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });
const yearsAgo = (n) => `${Number(budapestToday().slice(0, 4)) - n}-01-01`;

// a jelöltek forrásai (TMDB-listák, oldalanként 20 cím), a rangsor paraméterei:
//   rate: ennyi (a TMDB-előrangsor szerinti) legjobb jelölt IMDb-értékelése kell
//   m: a súlyozás „szavazat-súlya”; minVotes / maxVotes / minRating: a bekerülés feltétele (IMDb)
function plan(type, list) {
  const d = type === 'movie' ? 'primary_release_date' : 'first_air_date';
  const discover = `/discover/${type}`;
  const since = { [`${d}.gte`]: yearsAgo(5), [`${d}.lte`]: budapestToday() };
  if (list === 'all') {
    return {
      sources: [
        { path: `/${type}/top_rated`, params: {}, pages: type === 'movie' ? 12 : 10 },
        { path: discover, params: { sort_by: 'vote_count.desc' }, pages: type === 'movie' ? 8 : 5 },
      ],
      rate: 160,
      m: type === 'movie' ? 25000 : 20000,
      minVotes: type === 'movie' ? 10000 : 5000,
    };
  }
  if (list === 'recent') {
    return {
      sources: [
        { path: discover, params: { ...since, sort_by: 'vote_count.desc' }, pages: 8 },
        { path: discover, params: { ...since, sort_by: 'vote_average.desc', 'vote_count.gte': type === 'movie' ? '300' : '100' }, pages: 5 },
      ],
      rate: 160,
      m: type === 'movie' ? 15000 : 5000,
      minVotes: type === 'movie' ? 5000 : 2000,
      since: since[`${d}.gte`],
    };
  }
  // rejtett gyöngyszemek: magasra értékelt, de kevésbé ismert címek (Norbi: IMDb ≥ 7,5, 5–150 ezer szavazat)
  return {
    sources: [
      {
        path: discover,
        params: {
          sort_by: 'vote_average.desc',
          'vote_count.gte': type === 'movie' ? '300' : '80',
          'vote_count.lte': type === 'movie' ? '4000' : '1500',
        },
        pages: type === 'movie' ? 12 : 8,
      },
    ],
    rate: 100,
    m: 3000,
    minVotes: 5000,
    maxVotes: 150000,
    minRating: 7.5,
  };
}

// a TMDB-lista találataiból az alkalmas jelöltek (a részletek nélkül eldönthető szűrők)
function usable(r) {
  if (r.adult || !r.poster_path || !r.overview) return false; // magyar leírás nélkül a szinkron is valószínűtlen
  const genres = r.genre_ids ?? [];
  if (genres.some((g) => SKIP_GENRES.has(g))) return false;
  if (genres.length === 1 && genres[0] === MUSIC_GENRE) return false;
  return true;
}

// TMDB-előrangsor (ugyanaz a súlyozás a TMDB-szavazatokkal): ebből dől el, kiknek kérjük le az IMDb-t
const tmdbScore = (r, m, C) => (r.vote_count / (r.vote_count + m)) * r.vote_average + (m / (r.vote_count + m)) * C;

async function candidates(type, { sources }) {
  const byId = new Map();
  for (const s of sources) {
    // az oldalak párhuzamosan (a sorrend megmarad); az utolsó utáni oldal üres találatot ad
    const pages = Array.from({ length: s.pages }, (_, i) => i + 1);
    const results = await mapLimit(pages, DETAIL_PARALLEL, (page) =>
      tmdbFetch(s.path, { language: 'hu-HU', ...s.params, page: String(page) })
    );
    for (const data of results) {
      for (const r of data.results ?? []) if (usable(r) && !byId.has(r.id)) byId.set(r.id, r);
    }
  }
  return [...byId.values()];
}

// a cím részletei: IMDb-azonosító, magyar megjelenés / szolgáltatók, magyar műfajnevek (egy napig a memóriában)
function details(type, id) {
  const append = type === 'movie' ? 'external_ids,release_dates,watch/providers' : 'external_ids,watch/providers';
  return cached(`toplist:d:${type}:${id}`, DAY_MS, () => tmdbFetch(`/${type}/${id}`, { language: 'hu-HU', append_to_response: append }));
}

// Magyarul is megjelent-e (Norbi döntése, „laza” szabály, 2026-10-20): film – angol / magyar eredetinél
// magyarországi megjelenés vagy bármilyen magyar szolgáltató (a régi klasszikusoknál gyakran csak ez van),
// más nyelvűnél csak a magyarországi bemutató / digitális megjelenés (ott jellemzően van szinkron);
// sorozat – magyar előfizetéses / ingyenes streaming.
function huOk(type, d) {
  const hu = d['watch/providers']?.results?.HU ?? {};
  const stream = ['flatrate', 'free', 'ads'].some((k) => hu[k]?.length);
  if (type === 'tv') return stream;
  const release = (d.release_dates?.results ?? []).some((x) => x.iso_3166_1 === 'HU');
  if (['en', 'hu'].includes(d.original_language)) return release || stream || ['rent', 'buy'].some((k) => hu[k]?.length);
  return release;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

// az IMDb-értékelések: imdbId → { rating, votes } (null-ok is lehetnek); missing: amit ma már nem kértünk le
async function ratingsFor(db, imdbIds) {
  const result = new Map();
  const cutoff = Date.now() - RATING_DAYS * DAY_MS;
  const { data: stored, error } = await db.from('imdb_ratings').select('imdb_id, rating, votes, checked_at').in('imdb_id', imdbIds);
  if (error) throw error;
  for (const r of stored) {
    if (Date.parse(r.checked_at) >= cutoff) result.set(r.imdb_id, { rating: r.rating == null ? null : Number(r.rating), votes: r.votes });
  }
  // a saját lista sorai (az app 14 naponta frissíti őket) – így ezekért nem kell az OMDb-hez fordulni
  let todo = imdbIds.filter((id) => !result.has(id));
  if (todo.length) {
    const since = new Date(cutoff).toISOString();
    const { data: own } = await db
      .from('titles')
      .select('imdb_id, imdb_rating, imdb_votes')
      .in('imdb_id', todo)
      .gte('imdb_rating_updated_at', since)
      .not('imdb_rating', 'is', null);
    for (const t of own ?? []) result.set(t.imdb_id, { rating: Number(t.imdb_rating), votes: t.imdb_votes });
    todo = todo.filter((id) => !result.has(id));
  }
  if (!todo.length || !omdbEnabled()) return { result, missing: todo.length };

  // OMDb, a napi kereten belül
  const { data: used, error: usedError } = await db.rpc('imdb_ratings_today');
  if (usedError) throw usedError;
  const budget = Math.max(0, DAILY_OMDB - (used ?? 0));
  const asked = todo.slice(0, budget);
  let stop = false; // kulcs- / kerethiba vagy elérhetetlen OMDb: ma már nem próbálkozunk
  const fresh = [];
  await mapLimit(asked, OMDB_PARALLEL, async (imdbId) => {
    if (stop) return;
    try {
      const { imdb_rating, imdb_votes } = await fetchImdbRating(imdbId);
      fresh.push({ imdb_id: imdbId, rating: imdb_rating, votes: imdb_votes });
      result.set(imdbId, { rating: imdb_rating, votes: imdb_votes });
    } catch (err) {
      console.error(err);
      stop = true;
    }
  });
  for (let i = 0; i < fresh.length; i += 200) {
    const { error: storeError } = await db.rpc('store_imdb_ratings', { p_items: fresh.slice(i, i + 200) });
    if (storeError) console.error(storeError);
  }
  return { result, missing: todo.filter((id) => !result.has(id)).length };
}

const DETAILS_FAILED = Symbol('details-failed');

// a lista összeállítása: { items, complete }
async function build(db, type, list) {
  const p = plan(type, list);
  const pool = await candidates(type, p);
  if (!pool.length) return { items: [], complete: true };

  // TMDB-előrangsor, aztán a részletek (magyar szűrő, IMDb-azonosító), amíg p.rate alkalmas jelölt nincs meg
  const C0 = pool.reduce((s, r) => s + r.vote_average, 0) / pool.length;
  pool.sort((a, b) => tmdbScore(b, p.m / 10, C0) - tmdbScore(a, p.m / 10, C0));
  // a részletek hibája hiánynak számít (a lista másnap újraépül); a 404 nem – az a TMDB-ről törölt cím
  const picked = [];
  let failed = 0;
  for (let i = 0; i < pool.length && picked.length < p.rate; i += DETAIL_PARALLEL * 2) {
    const chunk = pool.slice(i, i + DETAIL_PARALLEL * 2);
    const ds = await mapLimit(chunk, DETAIL_PARALLEL, (r) =>
      details(type, r.id).catch((err) => (err?.status === 404 ? null : DETAILS_FAILED))
    );
    chunk.forEach((r, j) => {
      const d = ds[j];
      if (picked.length >= p.rate) return;
      if (d === DETAILS_FAILED) {
        failed++;
        return;
      }
      const imdbId = d?.external_ids?.imdb_id;
      if (!d || !imdbId || !huOk(type, d)) return;
      const date = r.release_date ?? r.first_air_date ?? null;
      if (p.since && (!date || date < p.since)) return;
      picked.push({
        media_type: type,
        tmdb_id: r.id,
        imdb_id: imdbId,
        title: r.title ?? r.name,
        original_title: r.original_title ?? r.original_name,
        release_year: yearOf(date),
        release_date: date,
        poster_path: r.poster_path,
        genres: (d.genres ?? []).map((g) => g.name),
      });
    });
  }

  const ratings = await ratingsFor(db, picked.map((t) => t.imdb_id));
  const { result } = ratings;
  const missing = ratings.missing + failed;
  const rated = picked
    .map((t) => ({ ...t, imdb_rating: result.get(t.imdb_id)?.rating ?? null, imdb_votes: result.get(t.imdb_id)?.votes ?? null }))
    .filter(
      (t) =>
        t.imdb_rating != null &&
        t.imdb_votes != null &&
        t.imdb_votes >= p.minVotes &&
        (p.maxVotes == null || t.imdb_votes <= p.maxVotes) &&
        (p.minRating == null || t.imdb_rating >= p.minRating)
    );
  if (!rated.length) return { items: [], complete: missing === 0 };
  const C = rated.reduce((s, t) => s + t.imdb_rating, 0) / rated.length;
  const score = (t) => (t.imdb_votes / (t.imdb_votes + p.m)) * t.imdb_rating + (p.m / (t.imdb_votes + p.m)) * C;
  const items = rated
    .map((t) => ({ ...t, score: Math.round(score(t) * 1000) / 1000 }))
    .sort((a, b) => b.score - a.score || b.imdb_votes - a.imdb_votes)
    .slice(0, KEEP);
  return { items, complete: missing === 0 };
}

// esedékes-e az újraépítés: nincs még, LIST_DAYS-nál régebbi, vagy hiányos és még nem ma épült
// (a napi OMDb-keret másnap újraindul)
function due(row) {
  if (!row) return true;
  if (Date.now() - Date.parse(row.built_at) > LIST_DAYS * DAY_MS) return true;
  const builtDay = new Date(row.built_at).toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });
  return !row.complete && builtDay < budapestToday();
}

// egy szerverpéldányon egyszerre egy összeállítás listánként (a párhuzamos kérések ugyanazt várják)
const building = new Map();

// a lista (a felhasználó nevében futó db klienssel): { items, complete, built_at }
export async function loadToplist(db, type, list) {
  const key = `${type}:${list}`;
  const { data: row, error } = await db.from('toplists').select('items, complete, built_at').eq('key', key).maybeSingle();
  if (error) throw error;
  if (!due(row)) return row;

  let pending = building.get(key);
  if (!pending) {
    pending = (async () => {
      try {
        const { items, complete } = await build(db, type, list);
        // üres, hiányos eredmény (pl. az OMDb ma nem válaszolt) ne írja felül a meglévő listát
        if (!items.length && row?.items?.length) return row;
        const { error: storeError } = await db.rpc('store_toplist', { p_key: key, p_items: items, p_complete: complete });
        if (storeError) console.error(storeError);
        return { items, complete, built_at: new Date().toISOString() };
      } finally {
        building.delete(key);
      }
    })();
    building.set(key, pending);
  }
  try {
    return await pending;
  } catch (err) {
    if (row) {
      console.error(err);
      return row; // a régi lista még mindig jobb a semminél
    }
    throw err;
  }
}
