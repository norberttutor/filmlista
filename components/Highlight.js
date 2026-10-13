'use client';

import { createContext, useContext } from 'react';
import { highlightParts } from '@/lib/listSearch';

// Keresés a listán (terv-3 66): a Watchlist adja a kiemelendő szavakat (fold-olva) és azokat a címeket,
// amelyek a franchise nevük miatt kerültek a találatok közé – a kártya és a táblázat sora innen olvas.
export const SearchHighlight = createContext({ words: [], byFranchise: null });

export function useSearchHighlight() {
  return useContext(SearchHighlight);
}

// a szöveg, benne a keresett részek <mark>-kal (halk türkiz aláhúzás – „A” változat)
export function Hl({ text, words: own }) {
  const { words } = useContext(SearchHighlight);
  const parts = highlightParts(text, own ?? words);
  if (parts.length === 1 && !parts[0].hit) return text;
  return parts.map((p, i) => (p.hit ? <mark key={i} className="hl">{p.text}</mark> : p.text));
}
