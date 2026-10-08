'use client';

import { useEffect, useState } from 'react';
import { afterTransition } from '@/lib/viewTransition';

// Hangulatszín: a borító legjellemzőbb élénk színe. Egy kicsi borítót a böngésző vászonra
// rajzol (a TMDB képszervere engedi – CORS), a színeket 30°-os árnyalat-vödrökbe gyűjti (az
// élénk, világos képpontok számítanak többet; a sötét és szürke kimarad), és a legerősebb vödör
// átlagát adja vissza OKLCH-ban, rögzített világossággal és mérsékelt telítettséggel – így a
// rá épülő fények mellett a szövegek olvashatósága nem változik.
// A legkisebb borító (w92, ~5 KB – a 24×36-os vászonhoz bőven elég) saját gyorsítótár-kulccsal
// (`?szin`): a TMDB csak CORS-os kérésre küldi az engedélyt, és ha a böngésző gyorsítótárában
// ugyanez a kép engedély nélkül is ott van (pl. a harang w92-es képe), a vászonra rajzolás hibát
// adna – a külön kulcs miatt a kettő nem ütközhet. (Korábban w185, ~15 KB – 2026-10-05.)
const SMALL_BASE = 'https://image.tmdb.org/t/p/w92';
const CACHE_KEY = '?szin';
const LIGHTNESS = 0.72;
const MIN_CHROMA = 0.04;
const MAX_CHROMA = 0.13;

const cache = new Map(); // poster_path → Promise<string | null>

function toLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// sRGB (0–255) → OKLCH szín CSS-ben, a fenti világossággal és telítettség-határokkal
function toAmbient(r, g, b) {
  const [lr, lg, lb] = [r, g, b].map(toLinear);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.min(MAX_CHROMA, Math.max(MIN_CHROMA, Math.hypot(a, bb)));
  const hue = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return `oklch(${LIGHTNESS} ${chroma.toFixed(3)} ${hue.toFixed(1)})`;
}

function dominantColor(img) {
  const W = 24;
  const H = 36;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data; // CORS nélkül itt hibát dob → nincs szín
  const buckets = Array.from({ length: 12 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  const all = { w: 0, r: 0, g: 0, b: 0 };
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    all.w += 1;
    all.r += r;
    all.g += g;
    all.b += b;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const v = max / 255;
    const sat = max ? (max - min) / max : 0;
    if (v < 0.18 || sat < 0.25) continue; // túl sötét vagy szürke
    let h;
    if (max === r) h = ((g - b) / (max - min)) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    h = (h * 60 + 360) % 360;
    const w = sat * sat * v;
    const k = buckets[Math.floor(h / 30) % 12];
    k.w += w;
    k.r += r * w;
    k.g += g * w;
    k.b += b * w;
  }
  const best = buckets.reduce((x, y) => (y.w > x.w ? y : x));
  const src = best.w > 0.5 ? best : all; // szinte színtelen borító: az átlaga
  return toAmbient(src.r / src.w, src.g / src.w, src.b / src.w);
}

function measure(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    // a rajzolás és a számolás nem a nézetváltás közepén (a mozgás ne akadjon meg)
    img.onload = () =>
      afterTransition().then(() => {
        try {
          resolve(dominantColor(img));
        } catch {
          resolve(null);
        }
      });
    img.onerror = () => resolve(null);
    img.src = SMALL_BASE + path + CACHE_KEY;
  });
}

// A borító hangulatszíne (CSS-szín vagy null, amíg nincs kész / ha nem sikerült). Csak akkor
// számol, ha `enabled` – a kártyán és a soron az első rámutatáskor; egy borítót egyszer.
export function usePosterColor(posterPath, enabled = true) {
  const [result, setResult] = useState({ path: null, color: null });
  useEffect(() => {
    if (!posterPath || !enabled) return;
    let alive = true;
    if (!cache.has(posterPath)) cache.set(posterPath, measure(posterPath));
    cache
      .get(posterPath)
      .then((color) => afterTransition().then(() => color))
      .then((color) => {
        if (alive) setResult({ path: posterPath, color });
      });
    return () => {
      alive = false;
    };
  }, [posterPath, enabled]);
  return enabled && result.path === posterPath ? result.color : null;
}

// A franchise színének borítója (terv-3 47, 51.9, 51.10): a franchise legjobb IMDb-értékelésű,
// borítós címéé – a Franchise-ok csempéje, a Statisztika franchise-sávja és a gyűjtemény-ablak
// is ebből színez, így egy franchise mindenhol ugyanazt a színt kapja.
export function franchisePosterPath(franchiseId, titles) {
  const best = titles
    .filter((t) => t.franchise_id === franchiseId && t.poster_path)
    .sort((a, b) => (b.imdb_rating ?? -1) - (a.imdb_rating ?? -1) || (b.imdb_votes ?? 0) - (a.imdb_votes ?? 0))[0];
  return best?.poster_path ?? null;
}

// a hangulatszín a komponens gyökerére: CSS-változó + jelző attribútum (a CSS csak akkor
// színez, ha van szín)
export function ambientProps(color) {
  return color ? { style: { '--ambient': color }, 'data-ambient': '' } : {};
}
