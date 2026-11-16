'use client';

// Mentés közben az Esc ne zárja az ablakot (K2): a <dialog> „cancel” eseményének preventDefault-ja a Chrome-ban csak
// az első Esc-et állítja meg – a második (felhasználói aktiválás nélkül) már nem megakasztható, és az ablak bezárul
// (lásd lib/backClose.js). A keydown alapművelete indítja a bezárási kérést: ha azt a dokumentum rögzítő fázisában
// elnyeljük, nincs „cancel” sem. A fókusz ilyenkor gyakran a body-n van (a lenyomott gomb tiltott lett), ezért nem
// az ablak onKeyDown-ja. A Vissza gomb nem keydown – azt a backClose szintetikus, megakasztható „cancel”-je kezeli.
import { useEffect } from 'react';

export function useHoldEscape(active) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [active]);
}
