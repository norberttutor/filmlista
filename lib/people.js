import { useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { apiPost } from '@/lib/api';
import { titleKey } from '@/lib/titles';
import { personDue } from '@/lib/refreshDue';

// Kedvenc színészeim / alkotóim (M4, 27_followed_people.sql). Közös tároló (mint a
// lib/hiddenSuggestions.js): a Watchlist betöltéskor tölti, a komponensek a useFollowed()-dal olvassák
// (kulcs: followKey → { person_id, role, name, profile_path, created_at, checked_at }).
// role: 'actor' (a Szereplők közül) | 'director' (az adatlap „Rendező” sorából).

// a /api/tmdb/person kérés v paramétere: a böngésző egy napig tárolja a választ, ezért a mezők
// változásakor emeld (2: lead – M4, role)
export const PERSON_V = 2;

export const followKey = (personId, role) => `${role}:${personId}`;

let followed = new Map();
const NONE = new Map();
const listeners = new Set();

function set(next) {
  followed = next;
  for (const l of listeners) l();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useFollowed() {
  return useSyncExternalStore(subscribe, () => followed, () => NONE);
}

export async function loadFollowed() {
  const { data, error } = await supabase
    .from('followed_people')
    .select('person_id, role, name, profile_path, created_at, checked_at')
    .order('created_at')
    .order('person_id');
  if (error) throw error;
  set(new Map(data.map((p) => [followKey(p.person_id, p.role), p])));
  return data;
}

// kilépéskor (a következő belépő ne lássa)
export function resetFollowed() {
  set(new Map());
}

function followError(error) {
  console.error(error);
  return new Error('Nem sikerült menteni a követést. Próbáld újra; ha továbbra sem megy, nézd meg a böngésző konzolját (F12).');
}

// személyenként az adatbázis-műveletek sorban futnak (a gyors ki-be kattintás ne előzze meg egymást)
const queues = new Map();
function inOrder(key, run) {
  const job = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(run);
  queues.set(key, job);
  job.then(
    () => queues.get(key) === job && queues.delete(key),
    () => queues.get(key) === job && queues.delete(key)
  );
  return job;
}

// követés: azonnal látszik (hibánál visszaáll); person: { id, name, profile_path }
export async function followPerson(person, role) {
  const key = followKey(person.id, role);
  const row = { person_id: person.id, role, name: person.name, profile_path: person.profile_path ?? null };
  const before = followed;
  set(new Map([...followed, [key, { ...row, created_at: new Date().toISOString(), checked_at: null }]]));
  const { error } = await inOrder(key, () => supabase.from('followed_people').insert(row));
  // már követett (pl. másik lapon): rendben van
  if (error && error.code !== '23505') {
    set(before);
    throw followError(error);
  }
  // az első ellenőrzés (csak megjegyzi a meglévő filmjeit) rögtön a háttérben
  refreshPeople().catch((err) => console.warn('A követett személyek ellenőrzése sikertelen:', err.message));
}

export async function unfollowPerson(personId, role) {
  const key = followKey(personId, role);
  const before = followed;
  const next = new Map(followed);
  next.delete(key);
  set(next);
  const { error } = await inOrder(key, () =>
    supabase.from('followed_people').delete().eq('person_id', personId).eq('role', role)
  );
  if (error) {
    set(before);
    throw followError(error);
  }
}

// a követettek új filmjei a háttérben (/api/people/refresh, adagonként): hetente; az értesítések
// számát adja vissza. people: a betöltött követések (ha nincs esedékes, nem hív)
let running = null;
export function refreshPeople(isCancelled = () => false) {
  if (![...followed.values()].some((p) => personDue(p))) return Promise.resolve(0);
  // egyszerre egy futás (a követéskor indított és a betöltéskori ne fusson kétszer)
  running ??= (async () => {
    let count = 0;
    try {
      for (let round = 0; round < 10; round++) {
        if (isCancelled()) break;
        const { notified, remaining } = await apiPost('/api/people/refresh');
        count += notified;
        if (!remaining) break;
      }
      const now = new Date().toISOString();
      set(new Map([...followed].map(([k, p]) => [k, personDue(p) ? { ...p, checked_at: now } : p])));
    } finally {
      running = null;
    }
    return count;
  })();
  return running;
}

// ---------- a személy filmjei a listához mérve ----------

// a személy filmjei (a /api/tmdb/person credits-e) a lista szerint: a listán lévők mindig, a többiből
// a főszerepek (allRoles: minden szerep), animáció / vendégszereplés / borító nélküliek nélkül.
// Visszaad: { shown, onList, watched, more, soon } – onList / watched: a listán lévők / közülük a
// megnézettek; more: a listán nem lévő, már megjelent főszerepek száma; soon: a legközelebbi,
// dátummal bejelentett főszerep (nem a listán).
export function personSummary(credits, rows, today, allRoles = false) {
  const shown = credits.filter((c) => rows.has(titleKey(c)) || (!c.minor && (allRoles || c.lead)));
  const mine = credits.filter((c) => rows.has(titleKey(c)));
  const watched = mine.filter((c) => rows.get(titleKey(c)).status === 'watched').length;
  const others = credits.filter((c) => !rows.has(titleKey(c)) && !c.minor && c.lead);
  const released = others.filter((c) => c.release_date && c.release_date <= today);
  const soon = others
    .filter((c) => c.release_date && c.release_date > today)
    .sort((a, b) => a.release_date.localeCompare(b.release_date))[0] ?? null;
  return { shown, onList: mine.length, watched, more: released.length, soon };
}
