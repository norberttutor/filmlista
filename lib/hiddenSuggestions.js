import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { titleKey } from '@/lib/titles';
import { fetchAll } from '@/lib/fetchAll';
import { reportError } from '@/lib/errorLog';

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
  reportError(error);
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

// címenként az adatbázis-műveletek sorban futnak: a gyorsan utána jövő „Visszavonás” törlése nem
// előzheti meg az elrejtés még úton lévő beszúrását (különben a felület láthatónak mutatná, az
// adatbázisban mégis rejtve maradna – kódaudit #33). A felület frissítése azonnali marad.
const queues = new Map(); // titleKey → az utolsó művelet ígérete
function inOrder(key, run) {
  const job = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(run);
  queues.set(key, job);
  job.then(
    () => queues.get(key) === job && queues.delete(key),
    () => queues.get(key) === job && queues.delete(key)
  );
  return job;
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
  const key = titleKey(row);
  const before = hidden.get(key);
  set(new Map([[key, { ...row, created_at: new Date().toISOString() }], ...hidden]));
  const { error } = await inOrder(key, () => supabase.from('hidden_suggestions').insert(row));
  // már elrejtett (pl. másik lapon): rendben van
  if (error && error.code !== '23505') {
    revertKey(key, before);
    throw hiddenError(error);
  }
}

// visszahozás („Mégis érdekel” / „Visszavonás”)
export async function unhideSuggestion(r) {
  const key = titleKey(r);
  const before = hidden.get(key);
  const next = new Map(hidden);
  next.delete(key);
  set(next);
  const { error } = await inOrder(key, () =>
    supabase.from('hidden_suggestions').delete().eq('media_type', r.media_type).eq('tmdb_id', r.tmdb_id)
  );
  if (error) {
    revertKey(key, before);
    throw hiddenError(error);
  }
}

// elbukott mentés után csak ennek a címnek az állapota áll vissza – a közben végzett többi elrejtés / visszahozás
// megmarad (eddig a teljes korábbi állapot jött vissza, átnézés 3, R24); before: a cím korábbi bejegyzése vagy undefined
function revertKey(key, before) {
  const next = new Map(hidden);
  if (before) next.set(key, before);
  else next.delete(key);
  set(next);
}
