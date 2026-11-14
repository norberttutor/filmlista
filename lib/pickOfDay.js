// A nap filmje (terv-3 143): naponta egy film a letöltött, még meg nem nézett filmek közül. A választás a dátumból
// (budapesti nap) számolódik, így aznap minden eszközön ugyanaz – amíg a készlet ugyanaz. A „Másikat” választását
// az eszköz aznapra megjegyzi (localStorage; ha nem írható, csak a megnyitás idejére szól).
import { todayDate } from '@/lib/titles';

const KEY = (userId) => `filmlista-napfilmje:${userId}`;

// a sorsolás készlete: letöltött, megnézendő filmek, azonosító szerint (a napi választás ne függjön a sorrendtől)
export function pickPool(titles) {
  return titles
    .filter((t) => t.media_type === 'movie' && t.status === 'to_watch' && t.is_downloaded)
    .sort((a, b) => a.id - b.id);
}

// „nov. 14., szombat”
export function pickDayLabel() {
  return new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', month: 'short', day: 'numeric', weekday: 'long' }).format(
    new Date()
  );
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function readChoice(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY(userId)) ?? 'null');
    return saved?.date === todayDate() ? saved.id : null;
  } catch {
    return null;
  }
}

function saveChoice(userId, id) {
  try {
    localStorage.setItem(KEY(userId), JSON.stringify({ date: todayDate(), id }));
  } catch {
    // privát ablak / tiltott tároló: a választás csak most érvényes
  }
}

// a mai film (null: üres a készlet). Ha aznap a „Másikat”-tal mást választottál, és az még a készletben van, az.
export function dailyPick(pool, userId) {
  if (pool.length === 0) return null;
  const chosen = readChoice(userId);
  return pool.find((t) => t.id === chosen) ?? pool[hash(`${todayDate()}:${userId}`) % pool.length];
}

// „Másikat”: egy véletlen másik film a készletből (aznapra megjegyezve); egyelemű készletnél ugyanaz
export function anotherPick(pool, currentId, userId) {
  const others = pool.filter((t) => t.id !== currentId);
  if (others.length === 0) return pool[0] ?? null;
  const next = others[Math.floor(Math.random() * others.length)];
  saveChoice(userId, next.id);
  return next;
}
