'use client';

// A fő lista a leírás (overview) nélkül töltődik le (terv-3 131, P5): a letöltés ~60%-a volt, és ritkán változik.
// A leírást az eszközön már meglévő sorból vesszük át (az állapotból vagy a tárolt listából), ha a sor azóta nem
// változott (azonos updated_at – a titles minden írása lépteti, a leírás cseréje is); a hiányzók utána a háttérben
// jönnek, és a tárolt listával együtt helyben is megmaradnak (net nélkül is látszanak).
import { supabase } from '@/lib/supabase';
import { fetchAll } from '@/lib/fetchAll';

// a titles_with_genres oszlopai az overview kivételével – a nézet új oszlopát ide is fel kell venni
// (a teszt – munka/e2e/test-p5.mjs – az adatbázis nézetével veti össze)
export const LIST_COLUMNS =
  'id, user_id, media_type, title, original_title, release_year, poster_path, tmdb_id, imdb_id, status, my_rating, ' +
  'notes, watched_at, created_at, updated_at, is_downloaded, mama_status, franchise_id, imdb_rating, imdb_votes, ' +
  'imdb_rating_updated_at, seasons_checked_at, backdrop_path, backdrop_checked_at, theatrical_release, ' +
  'digital_release, release_checked_at, tmdb_collection_id, collection_checked_at, franchise_suggestion_off, ' +
  'release_date, details_checked_at, runtime, series_status, rt_rating, mc_rating, status_name, genres, seasons';

// ennél több hiányzónál egyben (ezres adagokban) az összeset kéri, különben azonosítónként, adagolva
const BULK_FROM = 200;
const PART = 100;

// rows: a leírás nélküli friss sorok; sources: sorlisták (az elsőbb erősebb), amelyekből a leírás átvehető.
// { rows, missing }: a kitöltött sorok és azok azonosítói, amelyeknél a leírás hiányzik (a sorban nincs overview kulcs)
export function withOverviews(rows, ...sources) {
  const known = new Map();
  for (const list of sources.toReversed()) {
    for (const t of list ?? []) if ('overview' in t) known.set(t.id, t);
  }
  const missing = [];
  const filled = rows.map((t) => {
    const k = known.get(t.id);
    if (k && k.updated_at === t.updated_at) return { ...t, overview: k.overview };
    missing.push(t.id);
    return t;
  });
  return { rows: filled, missing };
}

// a hiányzó leírások letöltése és beírása a listába (csak a még leírás nélküli sorba – a közben teljes sorral
// cserélt cím a sajátját tartja); isCancelled: kilépés / újabb betöltés után már nem ír
export async function fillOverviews(ids, setTitles, isCancelled) {
  if (!ids.length) return;
  const got = new Map();
  if (ids.length > BULK_FROM) {
    const { data, error } = await fetchAll(() => supabase.from('titles').select('id, overview').order('id'));
    if (error) return console.warn('A leírások betöltése sikertelen:', error.message);
    for (const r of data) got.set(r.id, r.overview);
  } else {
    for (let i = 0; i < ids.length; i += PART) {
      const { data, error } = await supabase.from('titles').select('id, overview').in('id', ids.slice(i, i + PART));
      if (error) return console.warn('A leírások betöltése sikertelen:', error.message);
      for (const r of data) got.set(r.id, r.overview);
    }
  }
  if (isCancelled()) return;
  setTitles((prev) => prev.map((t) => (got.has(t.id) && !('overview' in t) ? { ...t, overview: got.get(t.id) } : t)));
}
