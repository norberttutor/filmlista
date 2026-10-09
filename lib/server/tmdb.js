// TMDB API hívások – csak route handlerből használható,
// mert a TMDB_READ_TOKEN nem kerülhet a böngészőbe.

const TMDB_API = 'https://api.themoviedb.org/3';

class TmdbError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status; // a TMDB HTTP státusza, vagy null, ha nincs token
  }
}

export async function tmdbFetch(path, params = {}) {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) throw new TmdbError('A TMDB_READ_TOKEN nincs beállítva', null);

  const url = new URL(TMDB_API + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
  if (!res.ok) throw new TmdbError(`TMDB ${res.status}: ${await res.text()}`, res.status);
  return res.json();
}

// Egyszerű, memóriában tartott gyorsítótár (a szerverpéldány élete alatt): a ritkán változó
// TMDB-listákhoz (Felfedezés, gyűjtemények), hogy ne kérdezzük le őket minden megnyitáskor.
// A hibát nem tárolja.
const cache = new Map();

// Böngésző-gyorsítótár a nyilvános TMDB-adatot adó GET-válaszokra: a böngésző `seconds` ideig
// kérés nélkül a tárolt választ adja (újranyitott adatlap, Felfedezés). „private”: csak a
// böngésző tárolja (a kérés tokennel megy), a Vercel nem. Hibaválaszra nem kerül.
export const DAY_S = 24 * 60 * 60;
export const HOUR_S = 60 * 60;
export function cachedResponse(body, seconds) {
  return Response.json(body, { headers: { 'Cache-Control': `private, max-age=${seconds}` } });
}

// keep(érték): tárolja-e (pl. a részben hiányos eredményt ne – kódaudit #5)
export async function cached(key, ttlMs, load, keep = () => true) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await load();
  if (!keep(value)) return value;
  cache.set(key, { value, until: Date.now() + ttlMs });
  if (cache.size > 500) cache.delete(cache.keys().next().value); // a legrégebbi ki
  return value;
}

// A hibát a felhasználónak szóló, magyar üzenetű válasszá alakítja.
export function tmdbErrorResponse(err) {
  console.error(err);

  if (err.status === null || err.status === 401) {
    return Response.json(
      {
        error:
          'A szerveren hiányzik vagy hibás a TMDB_READ_TOKEN. Ellenőrizd a .env.local fájlt (Vercelen: Settings → Environment Variables), majd indítsd újra az appot.',
      },
      { status: 500 }
    );
  }
  if (err.status === 404) {
    return Response.json({ error: 'Ez a cím nem található a TMDB-n.' }, { status: 404 });
  }
  return Response.json(
    { error: 'A TMDB most nem érhető el. Próbáld újra pár perc múlva.' },
    { status: 502 }
  );
}

// Film/sorozat címlogója a TMDB images válaszából (logos tömb): a kompakt (legfeljebb 6:1
// arányú), angol vagy nyelv nélküli, legjobbra szavazott. Visszaad: file_path vagy null.
export function pickLogo(logos) {
  const compact = logos.filter((l) => l.aspect_ratio >= 1 && l.aspect_ratio <= 6);
  const pool = compact.length ? compact : logos;
  const lang = (l) => (l.iso_639_1 === 'en' ? 2 : l.iso_639_1 == null ? 1 : 0);
  return [...pool].sort((a, b) => lang(b) - lang(a) || b.vote_average - a.vote_average)[0]?.file_path ?? null;
}

// Film megjelenési dátumai a TMDB release_dates válaszából (results: országonként): a mozis
// (3 = mozi, ha nincs: 2 = korlátozott) és a digitális (4) bemutató – előbb a magyar, ha nincs,
// az amerikai; országon belül a legkorábbi. Visszaad: { theatrical_release, digital_release }
// ('YYYY-MM-DD' vagy null).
export function pickReleaseDates(results = []) {
  const of = (country, types) => {
    const dates = (results.find((r) => r.iso_3166_1 === country)?.release_dates ?? [])
      .filter((d) => types.includes(d.type) && d.release_date)
      .map((d) => d.release_date.slice(0, 10))
      .sort();
    return dates[0] ?? null;
  };
  const first = (types) => of('HU', types) ?? of('US', types);
  return { theatrical_release: first([3]) ?? first([2]), digital_release: first([4]) };
}

// Szereplők (terv-3 38): a top cast első 3 tagja a TMDB sorrendjében (`order`). Filmnél a credits,
// sorozatnál az aggregate_credits válasza (ott a szerep a roles[0].character).
export function pickCast(data) {
  return [...(data.cast ?? [])]
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .slice(0, 3)
    .map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character ?? c.roles?.[0]?.character ?? null,
      profile_path: c.profile_path ?? null,
    }));
}

// „Hol nézhető?” a TMDB watch/providers válaszából (az adatok forrása a JustWatch): a
// magyarországi előfizetéses (flatrate) és ingyenes (free, ads) szolgáltatók, a TMDB
// sorrendjében, mindegyik egyszer. Kölcsönzés / vásárlás nincs (Norbi döntése).
// Visszaad: [{ id, name, logo, free }]
export function pickProviders(results = {}) {
  const hu = results.HU ?? {};
  const seen = new Map();
  for (const [list, free] of [[hu.flatrate, false], [hu.free, true], [hu.ads, true]]) {
    for (const p of list ?? []) {
      if (!p.logo_path || seen.has(p.provider_id)) continue;
      seen.set(p.provider_id, {
        id: p.provider_id,
        name: p.provider_name,
        logo: p.logo_path,
        free,
        order: p.display_priority ?? 999,
      });
    }
  }
  return [...seen.values()].sort((a, b) => a.free - b.free || a.order - b.order).map(({ order, ...p }) => p);
}

// "2021-09-15" → 2021; üres dátumnál null
export function yearOf(date) {
  return date ? Number(date.slice(0, 4)) : null;
}

// Sorozat évadai a TMDB tv/{id} válaszából, a title_seasons tábla oszlopaival. A "0. évad"
// (különkiadások) kimarad; a bejelentett, még meg nem jelent évad air_date-je üres vagy
// jövőbeli – ez is felkerül (a felület "hamarosan" jelzéssel mutatja).
export function pickSeasons(data) {
  return (data.seasons ?? [])
    .filter((s) => s.season_number > 0)
    .map((s) => ({
      season_number: s.season_number,
      name: s.name || null,
      episode_count: s.episode_count ?? null,
      air_date: s.air_date || null,
    }));
}
