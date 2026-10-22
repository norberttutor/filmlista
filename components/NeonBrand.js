'use client';

import { useEffect, useRef } from 'react';
import { STALE_MS } from '@/lib/appVersion';
import { useTheme } from '@/lib/theme';

// Neonfelirat a fejlécben (D9, Norbi választása a látványterv után, 2026-10-19 – „Neon – Bricolage”,
// https://claude.ai/artifact/VzCx6F4njpfmNG7FvuUnp5): a cím neoncső. A szöveg maga a kikapcsolt üvegcső,
// fölötte az égő réteg (::after, data-text – így a cím szövege és a felolvasó neve nem duplázódik); a fény a
// „falra” is vetül (::before). Munkamenetenként egyszer felvillan (neon-on; „kevesebb mozgás”-nál rögtön ég).
// A színek: --neon-1 / --neon-2 (app/styles/01-szinek.css, világos / téka: 02-, 03-).
//
// A neon él (terv-3 132, Norbi döntése a bemutató után, 2026-10-22): (a) véletlenszerűen 1–4 percenként
// megrebben – többnyire az egyik cső kétszer (data-blip), kb. minden ötödik alkalommal az egész újra felkapcsol;
// csak látható lapon, nyitott ablak nélkül, legörgetve a kis cím (.top-compact, a fejlécben); (b) ≥ 5 perc
// távollét után visszatéréskor és (c) témaváltáskor újra felkapcsol; (d) rámutatásra / koppintásra a cső
// megrebben. A mozgás a 36-mozgas.css-ben – „kevesebb mozgás”-nál a 46 kikapcsolja, itt csak a jelzők váltanak.
const FLICKER_KEY = 'filmlista-neon';
const ON_MS = 1600; // a felkapcsolás (neon-on, 1,5 s) után lekerül a jelző – addig rebbenés nincs
const BLIP_MS = 520; // a rebbenés 0,45 s
const HOVER_GAP_MS = 900;
const nextDelay = () => 60_000 + Math.random() * 180_000;

// újraindítja a CSS-animációt: a jelző le, egy újraszámolás, vissza
function restart(el, set) {
  set(false);
  void el.offsetWidth;
  set(true);
}

export default function NeonBrand() {
  const ref = useRef(null);
  const timers = useRef({});
  const lastHover = useRef(0);
  const theme = useTheme();
  const lastTheme = useRef(theme);

  // a kis cím a fejléc saját eleme (Watchlist); legörgetve (data-compact) az látszik a nagy helyett
  const compactTitle = () => {
    const head = ref.current?.closest('.top');
    return head?.hasAttribute('data-compact') ? head.querySelector('.top-compact') : null;
  };

  const later = (key, ms, fn) => {
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, ms);
  };

  const switchOn = () => {
    const brand = ref.current;
    if (!brand) return;
    const small = compactTitle();
    const off = () => {
      brand.classList.remove('neon-on');
      brand.closest('.top')?.querySelector('.top-compact')?.removeAttribute('data-on');
    };
    for (const el of brand.closest('.top')?.querySelectorAll('[data-blip]') ?? []) el.removeAttribute('data-blip');
    off();
    if (small) restart(small, (on) => small.toggleAttribute('data-on', on));
    else restart(brand, (on) => brand.classList.toggle('neon-on', on));
    later('on', ON_MS, off);
  };

  // egy cső (vagy legörgetve a kis cím) megrebben; felkapcsolás közben nem
  const blip = (tube) => {
    const brand = ref.current;
    if (!brand || brand.classList.contains('neon-on')) return;
    const el = tube ?? compactTitle() ?? brand.querySelectorAll('.neon-line')[Math.random() < 0.5 ? 0 : 1];
    if (!el || el.hasAttribute('data-blip') || el.hasAttribute('data-on')) return;
    el.setAttribute('data-blip', '');
    setTimeout(() => el.removeAttribute('data-blip'), BLIP_MS);
  };

  // induláskor munkamenetenként egyszer
  useEffect(() => {
    try {
      if (sessionStorage.getItem(FLICKER_KEY)) return;
      sessionStorage.setItem(FLICKER_KEY, '1');
    } catch {
      return;
    }
    switchOn();
  }, []);

  // (a) időnként magától; (b) hosszú távollét után
  useEffect(() => {
    const visible = () => {
      const brand = ref.current;
      if (!brand || document.visibilityState !== 'visible' || document.querySelector('dialog[open]')) return false;
      // asztalon összecsukva a fejléc sávja is felgördül – akkor nincs mit rebbenteni
      const r = (compactTitle() ?? brand).getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    };
    const tick = () => {
      if (visible()) {
        if (Math.random() < 0.2) switchOn();
        else blip();
      }
      later('tick', nextDelay(), tick);
    };
    later('tick', nextDelay(), tick);

    let hiddenAt = document.visibilityState === 'hidden' ? Date.now() : null;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt != null && Date.now() - hiddenAt >= STALE_MS) switchOn();
      hiddenAt = null;
    };
    document.addEventListener('visibilitychange', onVisibility);
    const all = timers.current;
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      Object.values(all).forEach(clearTimeout);
    };
  }, []);

  // (c) témaváltáskor
  useEffect(() => {
    if (theme === lastTheme.current) return;
    lastTheme.current = theme;
    switchOn();
  }, [theme]);

  // (d) rámutatásra / koppintásra (az érintés is pointerenter-rel kezdődik)
  const onPointerEnter = (e) => {
    if (Date.now() - lastHover.current < HOVER_GAP_MS) return;
    lastHover.current = Date.now();
    blip(e.currentTarget);
  };

  return (
    <h1 className="brand neon" ref={ref}>
      <span className="neon-line" data-text="Megnézendő filmek" onPointerEnter={onPointerEnter}>
        Megnézendő filmek
      </span>{' '}
      <span className="neon-line l2" data-text="és sorozatok" onPointerEnter={onPointerEnter}>
        és sorozatok
      </span>
    </h1>
  );
}
