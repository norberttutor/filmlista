'use client';

// Asztalon (≥ 1400 px) választható nézet a fő listán (components/Watchlist.js): 'list' (táblázat) vagy 'grid'
// (borítófal); a böngésző megjegyzi (ha a tárhely nem érhető el, marad a lista). Keskenyebben mindig rács.
import { useLayoutEffect, useRef, useState } from 'react';
import { captureViewPosters, playViewSwitch, viewMotionOk } from '@/lib/viewSwitch';

const VIEW_KEY = 'filmlista-nezet';

function storedView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

export function useListView() {
  const [view, setView] = useState(storedView); // a Watchlist csak a böngészőben fut
  const gridRef = useRef(null); // a borítófal (animált átrendeződés, terv-3 49.3)

  // lista ↔ rács váltáskor a borítók a helyükre siklanak (terv-3 73): előtte a régi helyük
  const viewSwitch = useRef(null);
  const listRoot = (v) => (v === 'grid' ? gridRef.current : document.querySelector('.titles-table tbody'));
  function changeView(next) {
    if (next === view) return;
    viewSwitch.current = viewMotionOk() ? captureViewPosters(listRoot(view)) : null;
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // a választás így csak most érvényes
    }
  }

  // nézetváltás után (csak akkor – a többi függőség szándékosan nincs benne): a borítók a régi helyükről
  // az újra siklanak (terv-3 73)
  useLayoutEffect(() => {
    const before = viewSwitch.current;
    viewSwitch.current = null;
    if (!before?.size) return;
    const root = listRoot(view);
    playViewSwitch(before, root, view === 'grid' ? root : root?.closest('.table-wrap'));
  }, [view]);

  return { view, changeView, gridRef };
}
