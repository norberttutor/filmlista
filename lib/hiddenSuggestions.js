import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { titleKey } from '@/lib/titles';
import { fetchAll } from '@/lib/fetchAll';

// „Nem érdekel” – elrejtett ajánlások (terv-3 39, 16_hidden_suggestions.sql): a Felfedezés és a
// Hasonló címek nem mutatja őket (a keresés igen). Közös tároló (mint a lib/toast.js): a
// Watchlist betöltéskor tölti, a komponensek a useHiddenSuggestions()-szel olvassák (titleKey →
// { media_type, tmdb_id, title, poster_path, release_year, created_at }, legújabb elöl).

let hidden = new Map();
const NONE = new Map();
const listeners = new Set();

function set(next) {
  hidden = next;
  for (const l of listeners) l();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHiddenSuggestions() {
  return useSyncExternalStore(subscribe, () => hidden, () => NONE);
}

function hiddenError(error) {
  console.error(error);
  return new Error('Nem sikerült menteni. Próbáld újra; ha továbbra sem megy, nézd meg a böngésző konzolját (F12).');
}

export async function loadHidden() {
  const { data, error } = await fetchAll(() =>
    supabase
      .from('hidden_suggestions')
      .select('media_type, tmdb_id, title, poster_path, release_year, created_at')
      .order('created_at', { ascending: false })
      .order('media_type')
      .order('tmdb_id')
  );
  if (error) throw error;
  set(new Map(data.map((h) => [titleKey(h), h])));
}

// kilépéskor (a következő belépő ne lássa)
export function resetHidden() {
  set(new Map());
}

// elrejtés: azonnal eltűnik (hibánál visszajön); a cím, a borító és az év a listához tárolódik
export async function hideSuggestion(r) {
  const row = {
    media_type: r.media_type,
    tmdb_id: r.tmdb_id,
    title: r.title ?? null,
    poster_path: r.poster_path ?? null,
    release_year: r.release_year ?? null,
  };
  const before = hidden;
  set(new Map([[titleKey(row), { ...row, created_at: new Date().toISOString() }], ...hidden]));
  const { error } = await supabase.from('hidden_suggestions').insert(row);
  // már elrejtett (pl. másik lapon): rendben van
  if (error && error.code !== '23505') {
    set(before);
    throw hiddenError(error);
  }
}

// visszahozás („Mégis érdekel” / „Visszavonás”)
export async function unhideSuggestion(r) {
  const before = hidden;
  const next = new Map(hidden);
  next.delete(titleKey(r));
  set(next);
  const { error } = await supabase
    .from('hidden_suggestions')
    .delete()
    .eq('media_type', r.media_type)
    .eq('tmdb_id', r.tmdb_id);
  if (error) {
    set(before);
    throw hiddenError(error);
  }
}
