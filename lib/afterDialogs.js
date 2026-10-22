'use client';

import { useEffect, useState } from 'react';

// Ha nincs nyitott <dialog>, rögtön hívja az fn-t; különben akkor, amikor az utolsó is bezárult (a „close” nem
// buborékol, ezért a rögzítő fázisban figyeljük). A „close” nélkül, nyitva eltávolított ablakot (pl. a Franchise-ok
// „Szűrés erre”-je – a React leszedi) a DOM figyelése veszi észre. Visszaad egy lemondót.
export function afterDialogs(fn) {
  const open = () => document.querySelector('dialog[open]');
  if (!open()) {
    fn();
    return () => {};
  }
  const observer = new MutationObserver(() => check());
  const stop = () => {
    document.removeEventListener('close', check, true);
    observer.disconnect();
  };
  function check() {
    if (open()) return;
    stop();
    fn();
  }
  document.addEventListener('close', check, true);
  observer.observe(document.body, { childList: true, subtree: true });
  return stop;
}

// Egy jelölés megjelenésének mozgása (terv-3 141 a – a „Letöltve” jelvény): amikor az on hamisról igazra vált,
// 'wait' (a jelölés még ne látsszon – pl. az adatlap mögött, ahol a mozgás nem látszana), majd ha már nincs nyitott
// ablak, 'play' (a CSS-animáció ideje), utána null. Betöltéskor és újrarajzoláskor null.
const PLAY_MS = 450;

export function useAppearance(on) {
  const [s, setS] = useState({ on, phase: null });
  if (s.on !== on) setS({ on, phase: on ? 'wait' : null });
  const phase = s.phase;
  useEffect(() => {
    const next = (from, to) => setS((x) => (x.phase === from ? { ...x, phase: to } : x));
    if (phase === 'wait') return afterDialogs(() => next('wait', 'play'));
    if (phase !== 'play') return;
    const timer = setTimeout(() => next('play', null), PLAY_MS);
    return () => clearTimeout(timer);
  }, [phase]);
  return phase;
}
