'use client';

// A fő lista görgetése (components/Watchlist.js): összecsukódó fejléc, letapadt szűrősor, lebegő „+”
import { useEffect, useRef, useState } from 'react';

// A szűrősor görgetéskor a lap tetejére tapad: letapadva üveghatású ([data-stuck]); a
// magasságát (--filters-h) a táblázat ragadós fejléce kapja, hogy alatta tapadjon.
// Összecsukódó főcím (terv-3 99): a fejléc is ragad, negatív helyzettel (--head-h: a mért magassága) – görgetéskor
// csak az alsó, --head-c magas sávja marad fent (asztalon – „A – Egy sáv”, 2026-10-16 – nyitott „Cím hozzáadása” panel
// nélkül 0: a fejléc egészen felgördül), a szűrősor alatta tapad. A fejléc magassága nem változik
// (a lista nem ugrál): a --head-p (0–1, az összecsukódás útjának aránya) szerint a nagy cím összemegy és
// elhalványul, a gombsor a sáv jobb szélére csúszik (--acc-shift; ha a cím alá tört), a kis cím előtűnik.
// „Kevesebb mozgás” módban nincs közbülső állapot: csak összecsukott / nyitott.
// listShown: a szűrősor a lapon van; adding: a „Cím hozzáadása” panel a sáv magasságát is váltja (data-head-away)
export function useCollapsingHeader(listShown, adding) {
  const headRef = useRef(null); // a fejléc
  const filtersRef = useRef(null); // a szűrősor
  const [filtersStuck, setFiltersStuck] = useState(false);
  // telefonon a lebegő "+" gomb lefelé görgetéskor elhúzódik, felfelé visszajön
  const [fabHidden, setFabHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const el = filtersRef.current;
    const head = headRef.current;
    if (!el || !head) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let stickTop = 0; // a szűrősor ragadási helye (px): a fejléc sávja alatt
    let collapse = 1; // ennyi görgetés alatt csukódik össze a fejléc
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      // a sáv magassága a CSS-ből (--head-c, rem-ben; a main adja – data-head-away)
      const compact = (parseFloat(getComputedStyle(head).getPropertyValue('--head-c')) || 0) * rem;
      const h = head.offsetHeight;
      collapse = Math.max(1, h - compact);
      stickTop = parseFloat(getComputedStyle(el).top) || 0;
      document.documentElement.style.setProperty('--head-h', `${h}px`);
      const acc = head.querySelector('.account');
      if (acc) {
        const right = head.clientWidth - parseFloat(getComputedStyle(head).paddingRight);
        head.style.setProperty('--acc-shift', `${Math.max(0, right - acc.offsetLeft - acc.offsetWidth)}px`);
        head.style.setProperty('--acc-w', `${acc.offsetWidth}px`);
      }
    };
    const check = () => {
      frame = 0;
      const y = window.scrollY;
      let p = Math.min(1, Math.max(0, y / collapse));
      if (reduce.matches) p = p >= 1 ? 1 : 0;
      head.style.setProperty('--head-p', p.toFixed(3));
      head.toggleAttribute('data-compact', p >= 1);
      setFiltersStuck(y > 0 && el.getBoundingClientRect().top <= stickTop + 0.5);
      if (y <= 240 || y < lastScrollY.current - 6) setFabHidden(false);
      else if (y > lastScrollY.current + 6) setFabHidden(true);
      lastScrollY.current = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    const resize = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--filters-h', `${el.offsetHeight}px`);
      measure();
      onScroll();
    });
    resize.observe(el);
    resize.observe(head);
    measure();
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [listShown, adding]);

  return { headRef, filtersRef, filtersStuck, fabHidden };
}
