'use client';

import { useRef } from 'react';
import { apiGet } from '@/lib/api';

// Gyorsabb adatlap (terv-3 69, 2026-10-13): ha az egér ~150 ms-ig egy kártyán / soron áll, a háttérben
// lekéri az adatlap „Hol nézhető?”, Szereplők és előzetes adatait – ugyanazzal a címmel (URL-lel), mint a
// TitleEditor, így megnyitáskor a böngésző egynapos gyorsítótárából azonnal jönnek (Cache-Control:
// private, lib/server/tmdb.js). Csak egérrel (érintésnél nincs rámutatás), net mellett, címenként egyszer
// (munkamenetenként), egyszerre legfeljebb 2 címé; a hiba csendes (megnyitáskor úgyis újra kéri).

const DWELL_MS = 150;
const MAX_RUNNING = 2;
const done = new Set();
const queue = [];
let running = 0;

function pump() {
  while (running < MAX_RUNNING && queue.length) {
    const t = queue.shift();
    running++;
    const params = { type: t.media_type, id: t.tmdb_id };
    Promise.allSettled([
      apiGet('/api/tmdb/providers', params),
      apiGet('/api/tmdb/credits', { ...params, v: 3 }), // = a TitleEditor CREDITS_V-je
      apiGet('/api/tmdb/videos', params),
      apiGet('/api/tmdb/images', params), // a képgaléria (terv-3 95)
    ]).finally(() => {
      running--;
      pump();
    });
  }
}

export function prefetchTitle(t) {
  if (!t?.tmdb_id || !navigator.onLine) return;
  const key = `${t.media_type}:${t.tmdb_id}`;
  if (done.has(key)) return;
  done.add(key);
  queue.push(t);
  pump();
}

// a kártya / sor eseménykezelői: onPointerEnter + onPointerLeave
export function usePrefetchOnHover(t) {
  const timer = useRef(null);
  return {
    onPointerEnter: (e) => {
      if (e.pointerType !== 'mouse') return;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => prefetchTitle(t), DWELL_MS);
    },
    onPointerLeave: () => clearTimeout(timer.current),
  };
}
