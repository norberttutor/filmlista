'use client';

import { useEffect, useState } from 'react';

// Az adatlap később érkező részei (terv-3 138: Szereplők, „Hol nézhető?”, Hasonló címek, képek) beúsznak: az első
// megjelenésükkor egy ideig data-arrive jelzőt kapnak – a CSS (36-mozgas.css) erre tünteti elő az elemeiket egymás
// után –, utána lekerül, így ha a rész később újra látszik (a rejtett lap visszajön), nem ismétlődik.
// ready: a rész most van a lapon. Visszaadja a data-arrive értékét.
const ARRIVE_MS = 1000;

export function useArrival(ready) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!ready || settled) return;
    const timer = setTimeout(() => setSettled(true), ARRIVE_MS);
    return () => clearTimeout(timer);
  }, [ready, settled]);
  return ready && !settled ? '' : undefined;
}
