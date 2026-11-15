// A fő lista „Hol nézhető?” szűrőjének szolgáltatói (terv-3 144, Norbi választása: „A” lenyíló). A cím
// szolgáltatói a titles.watch_providers oszlopban (TMDB-azonosítók; forrásuk a JustWatch), a
// /api/tmdb/details (felvételkor) és a /api/tmdb/watch-providers (háttérben) tölti – mindkettő a
// providerIds()-szel. A szűrő csak az itt felsoroltakat kínálja (a magyar piac ismert előfizetéses
// szolgáltatói, a TMDB HU-sorrendjében); az RTL+ és a Magenta TV / Telekom TV GO nincs a TMDB adataiban.
// Logó: TMDB-képútvonal (w92); a név a magyar piacon ismert alakban.
export const PROVIDERS = [
  { id: 8, name: 'Netflix', logo: '/rK1KljqmbvO9HQa1PBFLILWah72.png' },
  { id: 119, name: 'Prime Video', logo: '/gMZdpavHmxFNnLpMHwVxfqeux2g.png' },
  { id: 350, name: 'Apple TV', logo: '/9icYBfYFcwgCbky5VdGUIKJ4C5i.png' },
  { id: 337, name: 'Disney+', logo: '/5eZ872CghnHFLB1j8grszbrx0dx.png' },
  { id: 701, name: 'FilmBox+', logo: '/AdXuRQPnQxT2Bl2K3BYKUhIyUrH.png' },
  { id: 1773, name: 'SkyShowtime', logo: '/ube1pVpP3FklRkeyQjlDkkC3tL2.png' },
  { id: 1899, name: 'HBO Max', logo: '/skypuy7SXuugIQeYg0IglmzoKaS.png' },
  { id: 11, name: 'MUBI', logo: '/k7iSlvgWzZuO4zU5PcBjhABMuia.png' },
];

export const PROVIDER_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

// a szűrő különleges értéke: a cím egyik ismert szolgáltatón sincs fent (a még nem ellenőrzött nem ilyen)
export const NO_PROVIDER = 'none';

// az „… Amazon Channel” változat a fő szolgáltatóhoz számít (ugyanaz az előfizetés, a Prime Video-n át)
const MERGE = { 2243: 350, 2801: 1773, 201: 11 };

// a TMDB watch/providers válaszának results-ából: a magyarországi előfizetéses, ingyenes és reklámos
// (flatrate + free + ads) szolgáltatók azonosítói, összevonva, mindegyik egyszer (kölcsönzés / vásárlás nem –
// mint az adatlap „Hol nézhető?” része, lib/server/tmdb.js pickProviders)
export function providerIds(results = {}) {
  const hu = results.HU ?? {};
  const ids = [...(hu.flatrate ?? []), ...(hu.free ?? []), ...(hu.ads ?? [])].map((p) => MERGE[p.provider_id] ?? p.provider_id);
  return [...new Set(ids)];
}

// az ismert (a szűrőben kínált) szolgáltatók azonosítói
export const PROVIDER_IDS = new Set(PROVIDERS.map((p) => p.id));

// a cím megfelel-e a szűrőnek (provider: '' | NO_PROVIDER | a szolgáltató azonosítója szövegként). Még nem
// ellenőrzött címnél (watch_providers null) egyik szolgáltató sem és az „Egyiken sem” sem illik rá.
export function providerMatches(t, provider) {
  if (!provider) return true;
  const ids = t.watch_providers;
  if (ids == null) return false;
  if (provider === NO_PROVIDER) return !ids.some((id) => PROVIDER_IDS.has(id));
  return ids.includes(Number(provider));
}
