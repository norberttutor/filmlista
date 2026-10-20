// A fő lista szűrőinek és rendezéseinek állandói (components/Watchlist.js, useListFilters.js, FilterBar.js)
import { DEFAULT_STATUS, DROPPED_STATUS, releaseKey } from '@/lib/titles';

// franchise-szűrő: '' = összes, NO_FRANCHISE = franchise nélküliek, egyébként franchise id
export const NO_FRANCHISE = 'none';

// a Filmek nézet állapotszűrőjében nincs ilyen gomb (a „Filmek és sorozatok” / Sorozatok nézetben van)
export const MOVIE_HIDDEN_STATUSES = new Set([DROPPED_STATUS, 'watching']);

export const TYPES = [
  { code: 'movie', name: 'Filmek' },
  { code: 'tv', name: 'Sorozatok' },
];
// csak kiválasztott franchise vagy keresés mellett választható (akkor ez az alapértelmezés)
export const BOTH_TYPES = { code: 'all', name: 'Filmek és sorozatok' };

export const DOWNLOAD_FILTERS = [
  { code: 'all', name: 'Összes' },
  { code: 'yes', name: 'Letöltött' },
  { code: 'no', name: 'Nem letöltött' },
];

// a szűrők alapállapota (betöltéskor és a ↺ gombbal)
export const DEFAULT_FILTERS = {
  type: 'movie',
  status: DEFAULT_STATUS,
  downloaded: 'no',
  genre: '',
  mama: '',
  franchise: NO_FRANCHISE,
};

// keresés közben minden cím látszik; a keresés előtti szűrők a keresés törlésekor visszaállnak
export const SEARCH_FILTERS = {
  type: 'all',
  status: 'all',
  downloaded: 'all',
  genre: '',
  mama: '',
  franchise: '',
};

export const sameFilters = (a, b) => Object.keys(a).every((k) => a[k] === b[k]);

const byAddedDesc = (a, b) => new Date(b.created_at) - new Date(a.created_at);

// üres érték (nincs értékelés) mindig a lista végére kerül;
// dir: -1 = csökkenő, 1 = növekvő
function nullsLast(x, y, dir) {
  if (x == null) return y == null ? 0 : 1;
  if (y == null) return -1;
  return dir * (x - y);
}

// megjelenés szerint, pontos dátummal (terv-3 55: korábban csak az év számított, így egy év címei –
// pl. a Marvelben – összekeveredtek); dátum és év nélkül a végére
function byRelease(a, b, dir) {
  const x = releaseKey(a);
  const y = releaseKey(b);
  if (x == null) return y == null ? 0 : 1;
  if (y == null) return -1;
  return dir * x.localeCompare(y);
}

// egyezésnél a legutóbb hozzáadott van elöl
export const SORTS = [
  { code: 'added_desc', name: 'Legutóbb hozzáadott', compare: byAddedDesc },
  { code: 'added_asc', name: 'Legkorábban hozzáadott', compare: (a, b) => -byAddedDesc(a, b) },
  {
    code: 'rating',
    name: 'Legjobb saját értékelés',
    compare: (a, b) => nullsLast(a.my_rating, b.my_rating, -1) || byAddedDesc(a, b),
  },
  {
    code: 'imdb',
    name: 'Legjobb IMDb-értékelés',
    compare: (a, b) => nullsLast(a.imdb_rating, b.imdb_rating, -1) || byAddedDesc(a, b),
  },
  {
    code: 'year_desc',
    name: 'Legújabb megjelenés',
    compare: (a, b) => byRelease(a, b, -1) || byAddedDesc(a, b),
  },
  {
    code: 'year_asc',
    name: 'Legrégebbi megjelenés',
    compare: (a, b) => byRelease(a, b, 1) || byAddedDesc(a, b),
  },
];

// franchise-ra szűrve, ha annak van saját nézési sorrendje (terv-3 28, Norbi döntése): a lista a
// sorrend tételeiből áll – a sorozat évadonként külön tétel, több helyen is szerepelhet –, és az
// állapot- és a letöltve-szűrő tételenként (évadnál az évadé) érvényes. Csak ilyenkor kínálja,
// és a franchise kiválasztásakor magától erre áll.
export const WATCH_ORDER = { code: 'watch_order', name: 'Nézési sorrend' };
// franchise-ra szűrve, ha nincs saját nézési sorrendje, alapból megjelenés szerint (Norbi kérése,
// 2026-10-06) – ugyanúgy magától, mint a nézési sorrend; kézi választás után az marad
export const FRANCHISE_SORT = 'year_asc';
