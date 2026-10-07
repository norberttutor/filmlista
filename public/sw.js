// Service worker – offline indulás (terv-3 44). A lista adatai nem itt vannak (azok a böngésző
// IndexedDB-jében, lib/offline.js); ez csak az oldal vázát, a programfájlokat és a borítóképeket
// tárolja, hogy az app net nélkül is elinduljon.
//  - az oldal (navigáció): előbb a hálózat (így egy új kiadás rögtön megjelenik), ha nem jön
//    válasz 3 mp alatt vagy nincs net, a legutóbb eltárolt változat
//  - /_next/static/…: a fájlnév a tartalomtól függ, sosem változik → előbb a tároló
//  - a TMDB borítói / logói: előbb a tároló (legfeljebb IMAGE_LIMIT kép)
//  - a többi saját fájl (ikonok, manifest): előbb a hálózat, hibánál a tároló
//  - /api/…, a Supabase és minden más: nem nyúl hozzá
// Ha a tárolás módja változik, emeld a VERSION-t (a régi tárolók törlődnek).
const VERSION = 'v1';
const SHELL = `filmlista-shell-${VERSION}`; // az oldal és a kis saját fájlok
const STATIC = `filmlista-static-${VERSION}`; // /_next/static/…
const IMAGES = `filmlista-images-${VERSION}`; // image.tmdb.org
const KEEP = [SHELL, STATIC, IMAGES];
const IMAGE_LIMIT = 1500;
const NAV_TIMEOUT = 3000;

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
    })()
  );
});

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
async function image(request) {
  const cache = await caches.open(IMAGES);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  let res;
  try {
    res = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
  } catch {
    return fetch(request);
  }
  if (res.ok) {
    await cache.put(request.url, res.clone()).catch(() => {});
    trimImages(cache);
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
    for (const req of keys.slice(0, Math.max(0, keys.length - IMAGE_LIMIT))) await cache.delete(req);
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
    event.respondWith(image(request));
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
