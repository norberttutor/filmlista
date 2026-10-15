import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '@/lib/useMediaQuery';

const PHONE_QUERY = '(max-width: 640px)';

// Telefonon (≤ 640 px) a fejléc felugró listája (harang, ⋮ menü) a képernyő teljes szélességén nyílik, közvetlenül a
// gomb alatt (átnézés K1, 2026-10-15). A lista ilyenkor a document.body-ba kerül (portál): az összecsukódó fejléc
// (terv-3 99) a gombsort eltolja / kicsinyíti, és a transform (a nyugalmi translate: 0 / scale: 1 is) a position:
// fixed listát a gombsorhoz igazítaná – ≈200 px széles lett. A helyét (top) a gombhoz méri, görgetéskor követi.
// A React-eseményeket a portál a komponens fáján át továbbítja (Esc, nyilak); a kívülre kattintás vizsgálatánál a
// lista elemét is nézni kell (a DOM-ban nincs a gomb mellett).
export function usePhonePopup(open, buttonRef) {
  const phone = useMediaQuery(PHONE_QUERY);
  const [top, setTop] = useState(null);

  useLayoutEffect(() => {
    if (!open || !phone) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      const r = buttonRef.current?.getBoundingClientRect();
      if (r) setTop(Math.round(r.bottom + 8));
    };
    const onMove = () => {
      if (!frame) frame = requestAnimationFrame(place);
    };
    place();
    window.addEventListener('scroll', onMove, { passive: true });
    window.addEventListener('resize', onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onMove);
      window.removeEventListener('resize', onMove);
    };
  }, [open, phone, buttonRef]);

  return {
    style: phone && top != null ? { top } : undefined,
    // a lista: telefonon a body-ba, különben a helyén
    render: (node) => (phone && node ? createPortal(node, document.body) : node),
  };
}
