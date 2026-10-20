'use client';

import { useCallback } from 'react';

// Vízszintesen görgethető sor halványuló széle (átnézés J14): a sor elemén data-fade-start / data-fade-end
// jelzi, hogy arra van még tartalom – a CSS ilyenkor maszkkal elhalványítja azt a szélt (így látszik, hogy
// görgethető, és a nem görgethető sor széle nem fakul feleslegesen). Görgetéskor, méretváltozáskor és a
// tartalom (pl. a szűrőcímkék) változásakor újramér. A visszaadott callback ref a sor elemére kerül.
export function useScrollFade() {
  return useCallback((el) => {
    if (!el) return;
    const measure = () => {
      const start = el.scrollLeft > 1;
      const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      el.toggleAttribute('data-fade-start', start);
      el.toggleAttribute('data-fade-end', end);
    };
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    const mutation = new MutationObserver(measure);
    mutation.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener('scroll', measure);
      resize.disconnect();
      mutation.disconnect();
    };
  }, []);
}
