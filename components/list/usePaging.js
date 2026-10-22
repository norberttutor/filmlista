'use client';

// A fő lista lapozása (components/Watchlist.js, components/Pagination.js)
import { useEffect, useState } from 'react';

export const PAGE_SIZE = 25; // ennyi cím egy oldalon (telefon, keskenyebb rács)
// asztali rácsban (≥ 1400 px): 1440p-n (2560 px) 11 kártya fér egy sorba → 2 teli sor, és a
// lapozó görgetés nélkül is látszik (Norbi kérése)
export const GRID_PAGE_SIZE = 22;
// asztali listanézetben (táblázat, terv-3 59 – Norbi kérése): a nagyobb, kártyaszerű sorokból 10
export const TABLE_PAGE_SIZE = 10;
const INTRO_KEY = 'filmlista-beuszas';

// entries: a látható bejegyzések; filterKey: a szűrés kulcsa (változásakor 1. oldal); anchorRef: lapozáskor
// ide görget (a szűrősor eredeti helye – a letapadt szűrősorhoz nem lehetne); shown: a lista a lapon van
export function usePaging(entries, filterKey, pageSize, anchorRef, shown) {
  // az oldal első címének helyét jegyezzük meg (first), így nézetváltáskor (más oldalméret) az az
  // oldal jön, amelyiken az addig látott első cím van
  const [pageState, setPageState] = useState({ key: filterKey, first: 0 });
  // szűrés- / rendezésváltáskor 1. oldal (akkor is, ha később ugyanez a szűrés jön vissza)
  if (pageState.key !== filterKey) setPageState({ key: filterKey, first: 0 });
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  const first = pageState.key === filterKey ? pageState.first : 0;
  const page = Math.min(Math.floor(first / pageSize) + 1, pageCount);
  const paged = entries.slice((page - 1) * pageSize, page * pageSize);

  // lapozáskor (terv-3 49.8) a kártyák / sorok egymás után úsznak be: a rács / táblázat egy ideig
  // data-paging jelzőt kap (a CSS erre indítja, a borítófal görgetéses beúszása addig áll)
  const [pageAnim, setPageAnim] = useState(0);
  useEffect(() => {
    if (!pageAnim) return;
    const timer = setTimeout(() => setPageAnim(0), 1200);
    return () => clearTimeout(timer);
  }, [pageAnim]);

  // induláskor (terv-3 135) munkamenetenként egyszer ugyanígy úsznak be, a neon felkapcsolásával együtt – a lista
  // első megjelenésekor (a tárolt vagy a friss, amelyik előbb jön)
  useEffect(() => {
    if (!shown) return;
    try {
      if (sessionStorage.getItem(INTRO_KEY)) return;
      sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      return;
    }
    setPageAnim((n) => n + 1);
  }, [shown]);

  function changePage(p) {
    setPageState({ key: filterKey, first: (p - 1) * pageSize });
    anchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPageAnim((n) => n + 1);
  }

  return { page, pageCount, paged, changePage, paging: pageAnim > 0 };
}
