// Service worker – offline indulás (terv-3 44). A lista adatai nem itt vannak (azok a böngésző
// IndexedDB-jében, lib/offline.js); ez csak az oldal vázát, a programfájlokat és a borítóképeket
// tárolja, hogy az app net nélkül is elinduljon.
//  - az oldal (navigáció): előbb a hálózat (így egy új kiadás rögtön megjelenik), ha nem jön
//    válasz 3 mp alatt vagy nincs net, a legutóbb eltárolt változat
//  - /_next/static/…: a fájlnév a tartalomtól függ, sosem változik → előbb a tároló
//  - a TMDB-képek: előbb a tároló. A lista borítói (és a franchise-logók) külön tárolóba kerülnek,
//    darabkorlát nélkül – azt a helyben tárolt lista (IndexedDB) dönti el, mi tartozik ide, és ami
//    már nincs a listán, törlődik. Minden más kép (adatlap, galéria, Felfedezés, színészek) egy kis,
//    EXTRA_LIMIT darabos tárolóba; a hangulatszín mintája (?szin) sehová (átnézés J12, 2026-10-16:
//    korábban minden egy közös, 1500-as tárolóba ment, és a nagy képek kiszorították a borítókat)
//  - a többi saját fájl (ikonok, manifest): előbb a hálózat, hibánál a tároló
//  - /api/…, a Supabase és minden más: nem nyúl hozzá
// Ha a tárolás módja változik, emeld a VERSION-t (a régi tárolók törlődnek).
const VERSION = 'v2';
const SHELL = `filmlista-shell-${VERSION}`; // az oldal és a kis saját fájlok
const STATIC = `filmlista-static-${VERSION}`; // /_next/static/…
const POSTERS = `filmlista-posters-${VERSION}`; // a lista borítói és a franchise-logók
const IMAGES = `filmlista-images-${VERSION}`; // a többi TMDB-kép
const KEEP = [SHELL, STATIC, POSTERS, IMAGES];
const EXTRA_LIMIT = 400;
const NAV_TIMEOUT = 3000;
// a lista képeinek méretei: PosterCard (w342), TitleTable (w185), FranchiseFilter logója (w185) – ha
// ott a méret változik, itt is
const LIST_SIZES = new Set(['w342', 'w185']);
const TMDB_IMAGE_RE = /^\/t\/p\/([^/]+)(\/.+)$/;

const STATIC_RE = /\/_next\/static\/[^"'\s)\\]+/g;

// a lap HTML-jében hivatkozott programfájlok
async function cacheStaticFrom(html) {
  const urls = [...new Set(html.match(STATIC_RE) ?? [])];
  const cache = await caches.open(STATIC);
  await Promise.all(
    urls.map(async (u) => {
      if (await cache.match(u)) return;
      try {
        const res = await fetch(u);
        if (res.ok) await cache.put(u, res);
      } catch {
        // majd legközelebb
      }
    })
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const res = await fetch('/', { cache: 'reload' });
        if (res.ok) {
          const html = await res.clone().text();
          await (await caches.open(SHELL)).put('/', res);
          await cacheStaticFrom(html);
        }
      } catch {
        // net nélkül is települjön: az első sikeres betöltéskor pótolja
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('filmlista-') && !KEEP.includes(key)) await caches.delete(key);
      }
      await self.clients.claim();
    })()
  );
});

// a lap betöltés után elküldi, milyen programfájlokat használt (a betűtípusok is ilyenek): ezeket
// eltároljuk, a régi kiadások fájljait pedig töröljük
self.addEventListener('message', (event) => {
  // kilépéskor (lib/offline.js clearSnapshots): a lista borítói se maradjanak a gépen
  if (event.data?.type === 'posters') {
    event.waitUntil(syncPosters());
    return;
  }
  if (event.data?.type !== 'assets') return;
  event.waitUntil(
    (async () => {
      const used = new Set(
        (event.data.urls ?? [])
          .map((u) => new URL(u, self.location.origin))
          .filter((u) => u.origin === self.location.origin && u.pathname.startsWith('/_next/static/'))
          .map((u) => u.pathname)
      );
      const cache = await caches.open(STATIC);
      for (const path of used) {
        if (await cache.match(path)) continue;
        try {
          const res = await fetch(path);
          if (res.ok) await cache.put(path, res);
        } catch {
          // majd legközelebb
        }
      }
      // a tárolt lap hivatkozásai is maradnak (pl. ha még a régi kiadás fut)
      const page = await (await caches.open(SHELL)).match('/');
      if (page) for (const p of (await page.text()).match(STATIC_RE) ?? []) used.add(p);
      for (const req of await cache.keys()) {
        if (!used.has(new URL(req.url).pathname)) await cache.delete(req);
      }
      // addigra a lista helyi mentése is megvan (1,5 mp): a borítótároló igazítása hozzá
      await syncPosters();
    })()
  );
});

// --- a lista képei: a helyben tárolt lista (lib/offline.js – ugyanaz az adatbázis és tároló) ---

// a tárolt listák (felhasználónként egy) borítói és franchise-logói útvonal szerint; null, ha az
// adatbázis nem olvasható (ilyenkor semmit nem törlünk)
function readListPaths() {
  return new Promise((resolve) => {
    let req;
    try {
      req = indexedDB.open('filmlista', 1);
    } catch {
      resolve(null);
      return;
    }
    // ha a service worker éri el elsőként, ugyanúgy hozza létre, mint a lap (különben a lap
    // megnyitásakor már nem futna le a létrehozás)
    req.onupgradeneeded = () => req.result.createObjectStore('snapshots');
    req.onerror = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const all = db.transaction('snapshots').objectStore('snapshots').getAll();
        all.onsuccess = () => {
          const paths = new Set();
          for (const s of all.result ?? []) {
            for (const t of s.titles ?? []) if (t.poster_path) paths.add(t.poster_path);
            for (const f of s.franchises ?? []) if (f.logo_path) paths.add(f.logo_path);
          }
          db.close();
          resolve(paths);
        };
        all.onerror = () => {
          db.close();
          resolve(null);
        };
      } catch {
        db.close();
        resolve(null);
      }
    };
  });
}

// a lista képei (rövid ideig megjegyezve: egy oldalnyi borító egyszerre érkezik)
let listPaths = null;
let listPathsAt = 0;
async function getListPaths(fresh = false) {
  if (fresh || !listPaths || Date.now() - listPathsAt > 30000) {
    listPaths = await readListPaths();
    listPathsAt = Date.now();
  }
  return listPaths;
}

function isListImage(url, paths) {
  const m = TMDB_IMAGE_RE.exec(url.pathname);
  return Boolean(m && !url.search && LIST_SIZES.has(m[1]) && paths?.has(m[2]));
}

// a borítótároló igazítása a listához: a listáról lekerült címek képei törlődnek, a még a kis
// tárolóban lévő listaképek átkerülnek (pl. az első betöltéskor, amikor a lista még nem volt helyben)
let syncing = false;
async function syncPosters() {
  if (syncing) return;
  syncing = true;
  try {
    const paths = await getListPaths(true);
    if (!paths) return;
    const posters = await caches.open(POSTERS);
    for (const req of await posters.keys()) {
      if (!isListImage(new URL(req.url), paths)) await posters.delete(req);
    }
    const extra = await caches.open(IMAGES);
    for (const req of await extra.keys()) {
      if (!isListImage(new URL(req.url), paths)) continue;
      const res = await extra.match(req);
      if (res) await posters.put(req, res).catch(() => {});
      await extra.delete(req);
    }
  } finally {
    syncing = false;
  }
}

async function navigate(request) {
  const cache = await caches.open(SHELL);
  const network = fetch(request).then(async (res) => {
    if (res.ok && res.type === 'basic') {
      // mindig a gyökér kulcsán: a ?nyit=… gyorsindítók is ugyanazt a lapot kapják
      await cache.put('/', res.clone());
    }
    return res;
  });
  network.catch(() => {}); // ha a tárolt lap nyert, a késő hálózati hiba ne legyen kezeletlen
  const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT, null));
  try {
    const res = await Promise.race([network, timeout]);
    if (res) return res;
  } catch {
    // nincs net: a tárolt lap
  }
  const cached = await cache.match('/');
  if (cached) return cached;
  return network; // nincs tárolt lap: a böngésző saját hibaoldala
}

async function cacheFirst(cacheName, request, key = request) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(key, res.clone()).catch(() => {});
  return res;
}

// a TMDB képszervere CORS-t enged: CORS-szal kérjük (az átlátszatlan – opaque – válasz tárolása
// képenként megabájtokat foglalna a kvótából); ha mégsem megy, a sima kérés, tárolás nélkül
async function image(request, url) {
  const posters = await caches.open(POSTERS);
  const extra = await caches.open(IMAGES);
  const hit = (await posters.match(request.url)) ?? (await extra.match(request.url));
  if (hit) return hit;
  let res;
  try {
    res = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
  } catch {
    return fetch(request);
  }
  if (res.ok) {
    if (isListImage(url, await getListPaths())) {
      await posters.put(request.url, res.clone()).catch(() => {});
    } else {
      await extra.put(request.url, res.clone()).catch(() => {});
      trimImages(extra);
    }
  }
  return res;
}

let trimming = false;
async function trimImages(cache) {
  if (trimming) return;
  trimming = true;
  try {
    const keys = await cache.keys();
    // a legrégebben eltároltak mennek (a keys() a tárolás sorrendjében adja őket)
    for (const req of keys.slice(0, Math.max(0, keys.length - EXTRA_LIMIT))) await cache.delete(req);
  } finally {
    trimming = false;
  }
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(request);
    if (res.ok && res.type === 'basic') await cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.hostname === 'image.tmdb.org') {
    // a hangulatszín mintája (lib/posterColor.js, ?szin): a böngésző saját gyorsítótára elég
    if (url.searchParams.has('szin')) return;
    event.respondWith(image(request, url));
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    if (url.pathname === '/') event.respondWith(navigate(request));
    return;
  }
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(STATIC, request, url.pathname));
    return;
  }
  // az /api, a Next belső kérései (?_rsc) és a fejlesztői szerver: hálózat, beavatkozás nélkül
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/') || url.searchParams.has('_rsc')) return;
  event.respondWith(networkFirst(request));
});
