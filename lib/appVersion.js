'use client';

import { useEffect, useRef } from 'react';
import { toast } from '@/lib/toast';

// Friss adatok visszatéréskor + „Frissült az app” sáv (terv-3 63, 2026-10-13).
// - Ha a lap legalább 5 percig rejtve volt (másik lap / app, lezárt telefon), visszatéréskor csendben
//   újratölti a listát és a harangot (onStale) – így pl. Mama közbeni jelölése is látszik.
// - Visszatéréskor (legalább 1 perc után) és félóránként megnézi, fut-e újabb kiadás (/api/version); ha
//   igen, egyszer sáv: „Frissült az app – az újratöltéssel az új változat indul.” + „Újratöltés”.
// Net nélkül (enabled: false) egyik sem.

const STALE_MS = 5 * 60 * 1000;
const CHECK_AFTER_MS = 60 * 1000;
const CHECK_EVERY_MS = 30 * 60 * 1000;
const OWN = process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev';

let announced = false; // munkamenetenként egyszer

async function checkVersion() {
  if (announced) return;
  try {
    const r = await fetch('/api/version', { cache: 'no-store' });
    if (!r.ok) return;
    const { version } = await r.json();
    if (!version || version === OWN || announced) return;
    announced = true;
    toast({
      text: 'Frissült az app – az újratöltéssel az új változat indul.',
      action: { label: 'Újratöltés', onClick: () => window.location.reload() },
      duration: null,
    });
  } catch {
    // net nélkül / szerverhiba: legközelebb újra
  }
}

export function useAppFreshness(enabled, onStale) {
  const staleRef = useRef(onStale);
  useEffect(() => {
    staleRef.current = onStale;
  });
  useEffect(() => {
    if (!enabled) return;
    let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : null;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt == null) return;
      const away = Date.now() - hiddenAt;
      hiddenAt = null;
      if (away >= STALE_MS) staleRef.current();
      if (away >= CHECK_AFTER_MS) checkVersion();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const timer = setInterval(() => document.visibilityState === 'visible' && checkVersion(), CHECK_EVERY_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(timer);
    };
  }, [enabled]);
}
