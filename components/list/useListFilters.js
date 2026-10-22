'use client';

// A fő lista szűrői, keresése és rendezése (components/Watchlist.js): a szűrők állapota, a látható bejegyzések
// (visible), a darabszámok és a „megtartott” sorok (kept). A szűrősor felülete: FilterBar.js.
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { DROPPED_STATUS, mamaLabel } from '@/lib/titles';
import { franchisesWithOrder, orderedItems } from '@/lib/watchOrder';
// keresés: kis- és nagybetű, valamint ékezet nélkül hasonlít ("dune" → "Dűne"); a franchise nevében is,
// elírásnál egy betűnyi eltéréssel (terv-3 66)
import { fold, matchTitle, resolveWords, searchIndex } from '@/lib/listSearch';
import {
  BOTH_TYPES,
  DEFAULT_FILTERS,
  DOWNLOAD_FILTERS,
  FRANCHISE_SORT,
  MOVIE_HIDDEN_STATUSES,
  NO_FRANCHISE,
  SEARCH_FILTERS,
  SORTS,
  TYPES,
  WATCH_ORDER,
  sameFilters,
} from '@/components/list/listFilters';

export function useListFilters({ titles, statuses, franchises, orders, franchiseName }) {
  // franchise kiválasztásakor az állapotszűrő magától „Mind” lesz, nézési sorrendtől függetlenül
  // (Norbi kérése, 2026-10-06); ez az előtte beállított érték – a franchise-szűrő megszűnésekor visszajön.
  // Kézi állapotválasztás vagy szűrőcsere (applyFilters) után nincs mit visszaállítani.
  const statusBeforeFranchise = useRef(null);

  const [status, setStatus] = useState(DEFAULT_FILTERS.status);
  const [type, setType] = useState(DEFAULT_FILTERS.type);
  const [genre, setGenre] = useState(DEFAULT_FILTERS.genre);
  const [mama, setMama] = useState(DEFAULT_FILTERS.mama); // '' | interested | received
  const [franchise, setFranchise] = useState(DEFAULT_FILTERS.franchise);
  const [downloaded, setDownloaded] = useState(DEFAULT_FILTERS.downloaded); // all | yes | no
  const [sort, setSort] = useState('added_desc');
  // franchise-ra szűrve magától áll be: nézési sorrend, ha van, különben a legrégebbi megjelenés
  // (amíg a felhasználó mást nem választ)
  const [orderSort, setOrderSort] = useState(true);
  // keresés a felvett címek között: a mező tartalma azonnal frissül, a lista szűrése (query) utána, megszakítható
  // átmenetben – a leütött betű nem vár a szűrésre (lassú telefonon az első betű 0,4 mp volt; terv-3 131, P3)
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  // a keresés előtti szűrők – ref, mert a gépelés idején a szűrők átmenete még függőben lehet
  const beforeSearch = useRef(null);
  const filters = { type, status, downloaded, genre, mama, franchise };

  function applyFilters(f) {
    statusBeforeFranchise.current = null;
    setType(f.type);
    setStatus(f.status);
    setDownloaded(f.downloaded);
    setGenre(f.genre);
    setMama(f.mama);
    setFranchise(f.franchise);
  }

  // a kiválasztott típus (filmek / sorozatok) címei
  const ofType = useMemo(
    () => (type === 'all' ? titles : titles.filter((t) => t.media_type === type)),
    [titles, type]
  );
  const franchiseChosen = franchise !== '' && franchise !== NO_FRANCHISE;
  // a Mama-szűrő Sorozatok típusnál és franchise-ra szűrve nem látszik és nem szűr (terv-3 58 – Mama
  // oldala úgyis csak a franchise nélküli filmeket kínálja); az értéke megmarad, visszaváltáskor visszajön
  const mamaOff = type === 'tv' || franchiseChosen;
  const mamaFilter = mamaOff ? '' : mama;

  // csak azok a műfajok, amelyek ennél a típusnál ténylegesen előfordulnak
  const genres = useMemo(
    () =>
      [...new Set(ofType.flatMap((t) => t.genres ?? []))].sort((a, b) =>
        a.localeCompare(b, 'hu')
      ),
    [ofType]
  );

  // a szűrőben a listán ténylegesen használt franchise-ok – típustól függetlenül, mert a
  // kiválasztásuk úgyis a filmeket és a sorozatokat is mutatja
  // a szűrő lehetőségei: a listán használt franchise-ok – és a kiválasztott akkor is, ha az utolsó
  // címe épp kikerült belőle (különben a szűrő „Összes”-t mutatna, miközben még rá szűr; a most
  // szerkesztett sor a helyén marad, a szűrő kézzel váltható; kódaudit #18)
  const usedFranchises = useMemo(() => {
    const used = new Set(titles.map((t) => t.franchise_id));
    return franchises.filter((f) => used.has(f.id) || String(f.id) === franchise);
  }, [titles, franchises, franchise]);

  // a franchise-szűrőben (terv-3 54, Norbi választása: „A”): franchise-onként hány listán lévő cím
  // nincs még megnézve (az abbahagyott sem számít) – „Van még megnézendő” (N hátra) / „Mind megnézve”
  const franchiseOptions = useMemo(() => {
    const left = new Map();
    for (const t of titles) {
      if (!t.franchise_id) continue;
      const open = t.status !== 'watched' && t.status !== DROPPED_STATUS;
      left.set(t.franchise_id, (left.get(t.franchise_id) ?? 0) + (open ? 1 : 0));
    }
    const opts = usedFranchises.map((f) => {
      const n = left.get(f.id) ?? 0;
      return { value: String(f.id), label: f.name, logo: f.logo_path, group: n > 0 ? 'open' : 'done', badge: n > 0 ? `${n} hátra` : '✓ Mind megnézve' };
    });
    return [...opts.filter((o) => o.group === 'open'), ...opts.filter((o) => o.group === 'done')];
  }, [titles, usedFranchises]);

  const mamaUsed = useMemo(() => titles.some((t) => t.mama_status), [titles]);

  // keresés a címben, az eredeti címben és a franchise nevében; több szónál mindegyiknek szerepelnie kell.
  // Ha egy szóra a teljes listán sincs pontos találat, egy betűnyi elírást elnéz (words: a javított szavak)
  const typedWords = useMemo(() => fold(query).split(/\s+/).filter(Boolean), [query]);
  const searching = typedWords.length > 0;
  const searchIdx = useMemo(() => searchIndex(titles, franchiseName), [titles, franchiseName]);
  const { words, corrected } = useMemo(() => resolveWords(typedWords, searchIdx), [typedWords, searchIdx]);
  // a címek, amelyek csak a franchise nevük miatt illenek a keresésre (a sorukon a franchise kiemelve)
  const byFranchise = useMemo(() => {
    if (!searching) return null;
    const ids = new Set();
    for (const t of titles) if (matchTitle(words, searchIdx.get(t.id))?.byFranchise) ids.add(t.id);
    return ids;
  }, [searching, titles, words, searchIdx]);
  const highlight = useMemo(() => ({ words: searching ? words : [], byFranchise }), [searching, words, byFranchise]);

  // minden szűrő az állapot és a letöltve kivételével
  const baseFiltered = useMemo(
    () =>
      ofType.filter(
        (t) =>
          (!genre || (t.genres ?? []).includes(genre)) &&
          (!mamaFilter || t.mama_status === mamaFilter) &&
          (!franchise ||
            (franchise === NO_FRANCHISE
              ? t.franchise_id == null
              : String(t.franchise_id) === franchise)) &&
          (!searching || matchTitle(words, searchIdx.get(t.id)))
      ),
    [ofType, genre, mamaFilter, franchise, searching, words, searchIdx]
  );

  // minden szűrő az állapot kivételével – ebből jönnek az állapotgombok darabszámai
  const beforeStatus = useMemo(
    () => baseFiltered.filter((t) => downloaded === 'all' || t.is_downloaded === (downloaded === 'yes')),
    [baseFiltered, downloaded]
  );

  // nézési sorrend: csak ha a kiválasztott franchise-nak van saját sorrendje
  const orderFranchises = useMemo(() => franchisesWithOrder(titles, orders), [titles, orders]);
  const orderAvailable = franchiseChosen && orderFranchises.has(Number(franchise));
  const activeSort =
    franchiseChosen && orderSort ? (orderAvailable ? WATCH_ORDER.code : FRANCHISE_SORT) : sort;
  const orderList = useMemo(
    () => (activeSort === WATCH_ORDER.code ? orderedItems(Number(franchise), titles, orders).items : null),
    [activeSort, franchise, titles, orders]
  );
  // a sorrend tételei a szűrőkkel (a letöltve tételenként: évadnál az évadé)
  const itemsBeforeStatus = useMemo(() => {
    if (!orderList) return null;
    const ok = new Set(baseFiltered.map((t) => t.id));
    return orderList.filter(
      (i) => ok.has(i.title.id) && (downloaded === 'all' || i.downloaded === (downloaded === 'yes'))
    );
  }, [orderList, baseFiltered, downloaded]);
  // az állapotgombok „Mind” darabszáma
  const allCount = (itemsBeforeStatus ?? beforeStatus).length;

  // a Filmek nézetben nincs „Abbahagyva” (csak sorozatnál fordul elő) és „Folyamatban” (Norbi kérése,
  // 2026-10-18) gomb – MOVIE_HIDDEN_STATUSES
  const shownStatuses = useMemo(
    () => (type === 'movie' ? statuses.filter((s) => !MOVIE_HIDDEN_STATUSES.has(s.code)) : statuses),
    [statuses, type]
  );

  const countByStatus = useMemo(() => {
    const counts = {};
    for (const t of itemsBeforeStatus ?? beforeStatus) counts[t.status] = (counts[t.status] ?? 0) + 1;
    return counts;
  }, [itemsBeforeStatus, beforeStatus]);

  // a műfaj- és a Mama-lenyíló darabszámai (M3): címenként, a többi szűrővel (az adott szűrő nélkül)
  const facetCounts = useMemo(() => {
    const genre_ = { all: 0 };
    const mama_ = { all: 0 };
    for (const t of ofType) {
      if (
        (franchise && (franchise === NO_FRANCHISE ? t.franchise_id != null : String(t.franchise_id) !== franchise)) ||
        (searching && !matchTitle(words, searchIdx.get(t.id))) ||
        (status !== 'all' && t.status !== status) ||
        (downloaded !== 'all' && t.is_downloaded !== (downloaded === 'yes'))
      )
        continue;
      const gs = t.genres ?? [];
      if (!mamaFilter || t.mama_status === mamaFilter) {
        genre_.all++;
        for (const g of gs) genre_[g] = (genre_[g] ?? 0) + 1;
      }
      if (!genre || gs.includes(genre)) {
        mama_.all++;
        if (t.mama_status) mama_[t.mama_status] = (mama_[t.mama_status] ?? 0) + 1;
      }
    }
    return { genre: genre_, mama: mama_ };
  }, [ofType, franchise, searching, words, searchIdx, status, downloaded, mamaFilter, genre]);

  const typeOptions = franchiseChosen || searching ? [BOTH_TYPES, ...TYPES] : TYPES;
  const sortOptions = orderAvailable ? [WATCH_ORDER, ...SORTS] : SORTS;
  function changeSort(code) {
    if (code === WATCH_ORDER.code) {
      setOrderSort(true);
    } else {
      setSort(code);
      setOrderSort(false);
    }
  }

  // ha a szűrés vagy a rendezés változik (más kulcs): 1. oldal, és a megtartott sorok elengedve
  const filterKey = [type, status, genre, mamaFilter, franchise, downloaded, activeSort, words.join(' ')].join('|');

  // a most szerkesztett címek a helyükön maradnak, amíg a szűrés nem változik: pl. a "Nem
  // letöltött" nézetben letöltöttnek jelölt film nem tűnik el azonnal (a pipa visszavehető)
  // (nézési sorrendben a tételek: items – a tételkulcsok)
  const [kept, setKept] = useState({ key: filterKey, ids: [], items: [] });
  // szűrésváltáskor elengedjük őket (akkor is, ha később ugyanez a szűrés jön vissza)
  if (kept.key !== filterKey) setKept({ key: filterKey, ids: [], items: [] });
  const keptIds = useMemo(() => new Set(kept.ids), [kept]);
  const keptItems = useMemo(() => new Set(kept.items), [kept]);

  const statusNames = useMemo(() => new Map(statuses.map((s) => [s.code, s.name])), [statuses]);

  // a lista bejegyzései: { key, title, item } – az item csak nézési sorrendben (a tétel: film,
  // évad nélküli sorozat vagy egy évad), egyébként null
  const visible = useMemo(() => {
    if (itemsBeforeStatus) {
      const keys = new Set(itemsBeforeStatus.filter((i) => status === 'all' || i.status === status).map((i) => i.key));
      return orderList
        .filter((i) => keys.has(i.key) || keptItems.has(i.key))
        .map((i) => ({ key: i.key, title: i.title, item: { ...i, statusName: statusNames.get(i.status) } }));
    }
    const { compare } = SORTS.find((s) => s.code === activeSort);
    const matching = beforeStatus.filter((t) => status === 'all' || t.status === status);
    const ids = new Set(matching.map((t) => t.id));
    const stayed = ofType.filter((t) => keptIds.has(t.id) && !ids.has(t.id));
    return [...matching, ...stayed].sort(compare).map((t) => ({ key: t.id, title: t, item: null }));
  }, [itemsBeforeStatus, orderList, keptItems, statusNames, beforeStatus, ofType, keptIds, status, activeSort]);

  // keresésnél a lista fölötti mondat: elírás (a javított szavak) vagy a franchise neve szerinti találatok
  const frMatches = useMemo(() => {
    if (!byFranchise || corrected.length) return null;
    const hits = visible.filter((e) => byFranchise.has(e.title.id));
    if (!hits.length) return null;
    const ids = new Set(hits.map((e) => e.title.id));
    return { count: ids.size, names: [...new Set(hits.map((e) => franchiseName.get(e.title.franchise_id)))].filter(Boolean) };
  }, [byFranchise, corrected, visible, franchiseName]);

  // a legutóbbi renderelés szűrése és bejegyzései: a mentés (await) után hívott keepShown ne a
  // kattintáskori – azóta talán megváltozott – szűrést lássa (kódaudit #50)
  const listRef = useRef({ filterKey, visible });
  useEffect(() => {
    listRef.current = { filterKey, visible };
  }, [filterKey, visible]);

  // a cím sora a szűrés változásáig a helyén marad – de csak ha eddig is látszott: a szűrőbe nem illő, épp
  // felvett cím (pl. franchise-ra szűrve, az adatlapján mentve) ne kerüljön a listába
  function keepShown(row) {
    const { filterKey, visible } = listRef.current;
    const shown = visible.filter((e) => e.title.id === row.id);
    // nézési sorrendben a cím most látható tételei maradnak a helyükön
    const items = shown.filter((e) => e.item).map((e) => e.key);
    const ids = shown.length > 0 ? [row.id] : [];
    setKept((k) => ({
      key: filterKey,
      ids: k.key === filterKey ? [...new Set([...k.ids, ...ids])] : ids,
      items: k.key === filterKey ? [...new Set([...k.items, ...items])] : items,
    }));
  }

  function changeType(code) {
    setType(code);
    setGenre(''); // a filmek és sorozatok műfajai eltérnek
    if (code === 'movie' && MOVIE_HIDDEN_STATUSES.has(status)) setStatus('all');
    // a franchise-szűrő marad, ha az új típusnál is van ilyen cím (pl. Star Wars film és sorozat)
    if (
      franchiseChosen &&
      !titles.some(
        (t) => (code === 'all' || t.media_type === code) && String(t.franchise_id) === franchise
      )
    ) {
      setFranchise('');
    }
  }

  // "Filmek és sorozatok" helyett újra Filmek; a műfaj marad, ha a filmek között is van ilyen
  function backToMovies() {
    setType('movie');
    if (genre && !titles.some((t) => t.media_type === 'movie' && t.genres?.includes(genre))) {
      setGenre('');
    }
    if (MOVIE_HIDDEN_STATUSES.has(status)) setStatus('all');
  }

  // franchise kiválasztásakor alapból a filmek és a sorozatok is látszanak;
  // ha a franchise-szűrő megszűnik (és nincs keresés), újra Filmek
  function changeFranchise(value) {
    setFranchise(value);
    setOrderSort(true);
    if (value !== '' && value !== NO_FRANCHISE) {
      setType('all');
      setGenre('');
      if (statusBeforeFranchise.current === null) statusBeforeFranchise.current = status;
      setStatus('all');
      return;
    }
    const restore = statusBeforeFranchise.current;
    statusBeforeFranchise.current = null;
    const toMovies = type === 'all' && !searching;
    if (restore !== null) setStatus(toMovies && MOVIE_HIDDEN_STATUSES.has(restore) ? 'all' : restore);
    if (toMovies) backToMovies();
  }

  // a franchise (helyben vagy másik gépen – S9) törölve: a rá szűrő lista ne ragadjon be, és a keresés előtti
  // szűrők se hozzák vissza. gone(value): a szűrő értéke egy megszűnt franchise
  function releaseFranchise(gone) {
    if (gone(franchise)) changeFranchise('');
    const b = beforeSearch.current;
    if (b && gone(b.franchise)) {
      // mint a changeFranchise(''): a franchise-szűrő megszűnésekor a „Filmek és sorozatok” helyett újra Filmek
      const next = { ...b, franchise: '' };
      if (b.type === 'all') {
        next.type = 'movie';
        if (b.genre && !titles.some((t) => t.media_type === 'movie' && t.genres?.includes(b.genre))) next.genre = '';
        if (MOVIE_HIDDEN_STATUSES.has(b.status)) next.status = 'all';
      }
      beforeSearch.current = next;
    }
  }

  // kézi állapotválasztás: a franchise-szűrő megszűnésekor ez marad
  function pickStatus(value) {
    statusBeforeFranchise.current = null;
    setStatus(value);
  }

  // gépeléskor az egész listán keres (a szűrők félreállnak, keresés közben szűkíthető); a
  // keresés törlésekor visszaállnak a keresés előtti szűrők
  function changeQuery(value) {
    const nowSearching = fold(value).trim() !== '';
    const wasSearching = fold(searchInput).trim() !== '';
    setSearchInput(value);
    let next = null;
    if (nowSearching && !wasSearching) {
      beforeSearch.current = filters;
      next = SEARCH_FILTERS;
    } else if (!nowSearching && wasSearching) {
      next = beforeSearch.current ?? DEFAULT_FILTERS;
      beforeSearch.current = null;
    }
    // a keresőszöveg és a szűrők együtt váltanak (különben egy pillanatra a teljes, szűretlen lista látszana)
    startTransition(() => {
      setQuery(value);
      if (next) applyFilters(next);
    });
  }

  function clearSearch() {
    setSearchInput('');
    setQuery('');
    beforeSearch.current = null;
  }

  // a Franchise-ok ablakból („Szűrés erre”): a lista ennek a franchise-nak minden címét mutatja
  // (a többi szűrő elenged, a keresés törlődik)
  function showFranchise(id) {
    clearSearch();
    applyFilters({ ...SEARCH_FILTERS, franchise: String(id) });
    setOrderSort(true);
  }

  // a telefonos "Szűrők" gomb rövid összegzése, pl. "Filmek · Megnézendő · Nem letöltött ·
  // Franchise nélkül"
  const filterSummary = [
    (type === 'all' ? BOTH_TYPES : TYPES.find((t) => t.code === type))?.name,
    status === 'all' ? 'Minden állapot' : statuses.find((s) => s.code === status)?.name,
    downloaded !== 'all' && DOWNLOAD_FILTERS.find((d) => d.code === downloaded)?.name,
    genre,
    mamaFilter && `Mama: ${mamaLabel(mamaFilter)}`,
    franchise === NO_FRANCHISE
      ? usedFranchises.length > 0 && 'Franchise nélkül'
      : franchise && franchiseName.get(Number(franchise)),
  ]
    .filter(Boolean)
    .join(' · ');

  // telefonon a beállított szűrők címkeként (terv-3 101): a × az adott szűrőt „Összes” / „Mind” értékre állítja
  // (ugyanazokkal a függvényekkel, mint a lenyílók); a típus mindig be van állítva, azon nincs ×
  const activeFilters = [
    { key: 'type', label: (type === 'all' ? BOTH_TYPES : TYPES.find((t) => t.code === type))?.name },
    status !== 'all' && { key: 'status', label: statuses.find((s) => s.code === status)?.name, clear: () => pickStatus('all') },
    downloaded !== 'all' && {
      key: 'downloaded',
      label: DOWNLOAD_FILTERS.find((d) => d.code === downloaded)?.name,
      clear: () => setDownloaded('all'),
    },
    genre && { key: 'genre', label: genre, clear: () => setGenre('') },
    mamaFilter && { key: 'mama', label: `Mama: ${mamaLabel(mamaFilter)}`, clear: () => setMama('') },
    franchise === NO_FRANCHISE
      ? usedFranchises.length > 0 && { key: 'franchise', label: 'Franchise nélkül', clear: () => changeFranchise('') }
      : franchise && { key: 'franchise', label: franchiseName.get(Number(franchise)), clear: () => changeFranchise('') },
  ].filter((x) => x && x.label);

  // ↺: a szűrők alapállapota, keresés nélkül
  const atDefault = !searching && sameFilters(filters, DEFAULT_FILTERS);
  // keresés közben a szűrők még a keresés alapállapotában (minden cím)
  const atSearchFilters = sameFilters(filters, SEARCH_FILTERS);

  function resetToDefault() {
    clearSearch();
    applyFilters(DEFAULT_FILTERS);
  }

  // "Szűrők törlése" üres találatnál: minden cím látszik. Keresés közben a keresés marad; anélkül
  // a típus is (a "Filmek és sorozatok" csak franchise-szal választható, abból Filmek lesz).
  function clearFilters() {
    applyFilters(searching ? SEARCH_FILTERS : { ...SEARCH_FILTERS, type: type === 'all' ? 'movie' : type });
  }

  return {
    // a szűrők értékei
    type,
    status,
    genre,
    mama,
    mamaFilter,
    mamaOff,
    franchise,
    franchiseChosen,
    downloaded,
    searchInput,
    query,
    activeSort,
    filterKey,
    atDefault,
    atSearchFilters,
    // a választható értékek és darabszámok
    typeOptions,
    sortOptions,
    shownStatuses,
    countByStatus,
    allCount,
    genres,
    facetCounts,
    mamaUsed,
    usedFranchises,
    franchiseOptions,
    filterSummary,
    activeFilters,
    // keresés
    typedWords,
    searching,
    corrected,
    frMatches,
    highlight,
    // a lista
    ofType,
    visible,
    keepShown,
    // műveletek
    changeType,
    pickStatus,
    setDownloaded,
    setGenre,
    setMama,
    changeFranchise,
    releaseFranchise,
    changeSort,
    changeQuery,
    showFranchise,
    resetToDefault,
    clearFilters,
  };
}
