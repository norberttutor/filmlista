'use client';

import { useEffect, useRef, useState } from 'react';

// Lehúzás frissítéshez a telefonos (telepített) appban (terv-3 85, 2026-10-14, látványterv nélkül – Norbi
// kérése). A lap tetején lefelé húzva egy kis türkiz jelző követi az ujjat; a küszöbön túl elengedve
// onRefresh() fut (a Watchlist csendes újratöltése: csontváz nélkül, a szűrők, a lapozás maradnak), addig a
// jelző forog. Csak érintéssel és a telepített appban (display-mode: standalone – a böngészőben a Chrome
// saját lehúzása tölti újra a lapot); nyitott ablaknál (dialog) és belül görgetett elemben (pl. a
// kinyitott szűrősor) nem indul. „Kevesebb mozgás” módban a jelző nem forog.

const THRESHOLD = 72; // ennyit kell lehúzni (a csillapított távolság), hogy frissítsen
const MAX = 110;
const MIN_SPIN_MS = 600; // a gyors frissítés is látsszon

export function isStandalone() {
  return ['standalone', 'fullscreen', 'minimal-ui'].some((m) => window.matchMedia(`(display-mode: ${m})`).matches);
}

// a lapon belül görgetett elem (pl. a kinyitott szűrősor): ott a húzás a saját görgetése
function scrolledInside(el) {
  for (; el && el !== document.body; el = el.parentElement) if (el.scrollTop > 0) return true;
  return false;
}

export default function PullRefresh({ enabled, onRefresh }) {
  const [pull, setPull] = useState(0); // a csillapított húzás (px)
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef(null); // { x, y } – a húzás kezdete, vagy null
  const pullRef = useRef(0);
  const busy = useRef(false);
  const refreshRef = useRef(onRefresh);
  useEffect(() => {
    refreshRef.current = onRefresh;
  });

  useEffect(() => {
    if (!enabled || !isStandalone()) return;
    document.documentElement.dataset.pullRefresh = ''; // CSS: overscroll-behavior-y: contain
    const set = (v) => {
      pullRef.current = v;
      setPull(v);
    };
    const onStart = (e) => {
      start.current = null;
      if (busy.current || e.touches.length !== 1 || window.scrollY > 0) return;
      if (document.querySelector('dialog[open]') || scrolledInside(e.target)) return;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, active: false };
    };
    const onMove = (e) => {
      const s = start.current;
      if (!s) return;
      const dy = e.touches[0].clientY - s.y;
      const dx = Math.abs(e.touches[0].clientX - s.x);
      if (!s.active) {
        // csak a függőleges, lefelé húzás számít (a vízszintes sorok görgetése nem)
        if (dy < 8 && dx < 8) return;
        if (dy <= dx || window.scrollY > 0) {
          start.current = null;
          return;
        }
        s.active = true;
      }
      set(Math.min(MAX, Math.max(0, dy) * 0.5));
    };
    const onEnd = async () => {
      const s = start.current;
      start.current = null;
      if (!s?.active) return;
      if (pullRef.current < THRESHOLD) {
        set(0);
        return;
      }
      busy.current = true;
      setRefreshing(true);
      set(THRESHOLD);
      const began = Date.now();
      try {
        await refreshRef.current();
      } finally {
        await new Promise((r) => setTimeout(r, Math.max(0, MIN_SPIN_MS - (Date.now() - began))));
        busy.current = false;
        setRefreshing(false);
        set(0);
      }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      delete document.documentElement.dataset.pullRefresh;
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);

  const shown = pull > 0 || refreshing;
  const ready = pull >= THRESHOLD;
  return (
    <div
      className="pull-refresh"
      data-state={refreshing ? 'refreshing' : ready ? 'ready' : shown ? 'pulling' : undefined}
      style={{ '--pull': `${pull}px`, '--turn': `${(pull / THRESHOLD) * 270}deg` }}
      aria-hidden={!refreshing}
    >
      <span className="pull-refresh-dot">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {refreshing && (
        <span className="sr-only" role="status">
          Lista frissítése…
        </span>
      )}
    </div>
  );
}
