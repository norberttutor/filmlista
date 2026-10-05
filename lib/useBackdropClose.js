import { useRef } from 'react';

const PHONE_QUERY = '(max-width: 640px)';

// Natív <dialog> bezárása kikattintással (a sötét háttérre kattintva) – asztalon / tableten,
// telefonon nem (ott az ablak alsó lap vagy teljes szélességű). A lenyomásnak is kívül kell
// lennie: a szöveg kijelölése közben kicsúszó egér nem zár be. Ha a canClose() hamis (pl. mentetlen
// módosítás, szerkesztés vagy mentés folyamatban), nem zár, hanem az onBlocked fut (ha van).
// Használat: <dialog ref={dialogRef} {...useBackdropClose(dialogRef, { onClose, canClose })}>
// A beágyazott (a React-fában a <dialog>-on belül nyíló) ablak kattintása a külsőnek nem számít
// kívülnek: a cél ott a belső <dialog>.
export function useBackdropClose(dialogRef, { onClose, canClose = () => true, onBlocked }) {
  const pressedOutside = useRef(false);

  function isOutside(e) {
    const dialog = dialogRef.current;
    if (!dialog || e.target !== dialog) return false; // a háttérre kattintás célja maga a <dialog>
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  }

  return {
    onPointerDown: (e) => {
      pressedOutside.current = isOutside(e);
    },
    onClick: (e) => {
      if (!pressedOutside.current || !isOutside(e)) return;
      pressedOutside.current = false;
      if (window.matchMedia(PHONE_QUERY).matches) return;
      if (canClose()) onClose();
      else onBlocked?.();
    },
  };
}
