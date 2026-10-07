// Offline indulás (terv-3 44): a service worker (public/sw.js) regisztrálása, a legutóbbi lista
// helyben (IndexedDB) és a hálózat állapota. A lista így azonnal megjelenik a tárolt állapotból,
// net nélkül csak olvasható, és a friss adat a háttérben érkezik.
import { useSyncExternalStore } from 'react';

// a service worker csak a kiadott (production) változatban: fejlesztés közben a régi fájlokat adná
export function registerServiceWorker() {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
  const sendAssets = async () => {
    const reg = await navigator.serviceWorker.ready;
    const urls = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((u) => u.includes('/_next/static/'));
    reg.active?.postMessage({ type: 'assets', urls });
  };
  // a lap betöltése után kicsivel: addigra minden programfájl és betűtípus megjött
  const later = () => setTimeout(() => sendAssets().catch(() => {}), 3000);
  navigator.serviceWorker
    .register('/sw.js')
    .then(() => (document.readyState === 'complete' ? later() : window.addEventListener('load', later, { once: true })))
    .catch((err) => console.warn('A service worker nem települt:', err.message));
}

// --- a lista helyben (IndexedDB: felhasználónként egy pillanatkép) ---

const DB_NAME = 'filmlista';
const STORE = 'snapshots';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, run) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// { savedAt, titles, statuses, franchises, orders, notifications } vagy null; hibánál is null
// (privát ablak, letiltott tárhely – a lista ilyenkor egyszerűen a hálózatról jön)
export async function loadSnapshot(userId) {
  try {
    return (await withStore('readonly', (s) => s.get(userId))) ?? null;
  } catch {
    return null;
  }
}

export async function saveSnapshot(userId, data) {
  try {
    await withStore('readwrite', (s) => s.put({ ...data, savedAt: new Date().toISOString() }, userId));
  } catch (err) {
    console.warn('A lista helyi mentése sikertelen:', err?.message);
  }
}

// kilépéskor: a gépen ne maradjon a lista
export async function clearSnapshots() {
  try {
    await withStore('readwrite', (s) => s.clear());
  } catch {
    // nincs mit törölni
  }
}

// --- a hálózat állapota ---

function subscribe(onChange) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

// true, ha a böngésző szerint van hálózat (a tényleges elérhetőséget a lekérdezés hibája mutatja)
export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

// a bejelentkezés helyben tárolt adatai (a Supabase kliens tárolójából) – net nélkül, lejárt
// tokennel a getSession() nem ad munkamenetet, de a tárolt lista megmutatható
export function storedSession(storageKey) {
  try {
    const s = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    return s?.user?.id ? s : null;
  } catch {
    return null;
  }
}
