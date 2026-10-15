'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';

// Csúszó kijelölő a gombcsoportokon (terv-3 100, Norbi választása a látványterv után, 2026-10-15 –
// https://claude.ai/artifact/BDiSAgUT78ijod5PEMQLfs): a kiválasztott gomb halvány türkiz háttere nem ugrik, hanem
// rugózva átsiklik az újonnan választottra. A csoport a kiválasztott közvetlen gyermek ([aria-pressed="true"] /
// [aria-selected="true"]) helyét és méretét CSS-változókba írja (--thumb-x / -y / -w / -h, data-thumb); a jelölő a
// csoport ::before-ja (CSS: „Csúszó kijelölő”, .sliding), a kiválasztott gomb saját háttere ilyenkor átlátszó. Minden
// rajzolás után mér (olcsó: csak változáskor ír), és méretváltozáskor is (átméretezés, betöltődő betűk, változó
// darabszám). A mozgás csak az első elhelyezés után kapcsol be (data-thumb-anim), így megnyitáskor nem csúszik be.
// A visszaadott callback ref a csoport elemére kerül (később megjelenő csoportnál is működik).
export function useSlidingThumb() {
  const node = useRef(null);
  const last = useRef('');

  useLayoutEffect(() => {
    if (node.current) measure(node.current, last);
  });

  return useCallback((el) => {
    if (!el) return;
    node.current = el;
    last.current = '';
    measure(el, last);
    const observer = new ResizeObserver(() => measure(el, last));
    observer.observe(el);
    for (const child of el.children) observer.observe(child);
    const frame = requestAnimationFrame(() => el.setAttribute('data-thumb-anim', ''));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      if (node.current === el) node.current = null;
    };
  }, []);
}

function measure(el, last) {
  const on = el.querySelector(':scope > [aria-pressed="true"], :scope > [aria-selected="true"]');
  if (!on || !on.offsetWidth) {
    if (last.current) {
      el.removeAttribute('data-thumb');
      last.current = '';
    }
    return;
  }
  const key = `${on.offsetLeft} ${on.offsetTop} ${on.offsetWidth} ${on.offsetHeight}`;
  if (key === last.current) return;
  last.current = key;
  el.style.setProperty('--thumb-x', `${on.offsetLeft}px`);
  el.style.setProperty('--thumb-y', `${on.offsetTop}px`);
  el.style.setProperty('--thumb-w', `${on.offsetWidth}px`);
  el.style.setProperty('--thumb-h', `${on.offsetHeight}px`);
  el.setAttribute('data-thumb', '');
}
