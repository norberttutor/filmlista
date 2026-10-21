'use client';

import { useRef } from 'react';
import { nudgeDialog } from '@/lib/useBackdropClose';

const PHONE_QUERY = '(max-width: 640px)';

// Telefonon (≤ 640 px) az ablak alsó lap: a fogantyút (.sheet-handle) lefelé húzva bezárul (elég messzire
// vagy gyorsan), különben visszaugrik. A DialogClose (minden ablak, terv-3 122) és Mama adatlapja (MamaDetail)
// közös része (átnézés J10).
// dismiss: a bezárás (a kicsúszás után hívódik). canClose: ha hamis, nem zár – visszaugrik és megbillen
// (mint a kikattintás), utána az onBlocked fut. Visszaad: a fogantyú pointer-eseményei (rá kell teríteni).
export function useSheetDrag(dialogRef, dismiss, { canClose = () => true, onBlocked } = {}) {
  const drag = useRef(null); // { y, t, dy }
  const opts = useRef(null);
  opts.current = { dismiss, canClose, onBlocked };

  function onPointerDown(e) {
    if (!window.matchMedia(PHONE_QUERY).matches) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    dialogRef.current.style.transition = 'none';
  }

  function onPointerMove(e) {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    dialogRef.current.style.translate = `0 ${drag.current.dy}px`;
  }

  function end() {
    if (!drag.current) return;
    const { dy, t } = drag.current;
    drag.current = null;
    const dialog = dialogRef.current;
    dialog.style.transition = '';
    const fast = dy / (performance.now() - t) > 0.6; // px/ms
    if (!(dy > 110 || (fast && dy > 30))) {
      dialog.style.translate = '';
    } else if (!opts.current.canClose()) {
      dialog.style.translate = '';
      nudgeDialog(dialog);
      opts.current.onBlocked?.();
    } else {
      dialog.style.translate = '0 100%';
      setTimeout(() => opts.current.dismiss(), 180);
    }
  }

  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end };
}
