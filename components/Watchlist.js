'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { supabase } from '@/lib/supabase';
import PosterCard from '@/components/PosterCard';
import Pagination from '@/components/Pagination';
import ImdbRatingsImport from '@/components/ImdbRatingsImport';
import TitleSearch from '@/components/TitleSearch';
import TitleEditor from '@/components/TitleEditor';
import TitleTable from '@/components/TitleTable';
import {
  titleKey,
  updateTitle,
  deleteTitle,
  createFranchise,
  deleteFranchise,
  renameFranchise,
  refreshImdbRatings,
  refreshFranchiseLogos,
  refreshSeasons,
  refreshBackdrops,
  refreshReleases,
  DEFAULT_STATUS,
  DROPPED_STATUS,
  MAMA_OPTIONS,
  mamaLabel,
} from '@/lib/titles';
import FranchiseFilter from '@/components/FranchiseFilter';
import FranchiseCollection from '@/components/FranchiseCollection';
import NotificationBell from '@/components/NotificationBell';
import BulkImport from '@/components/BulkImport';
import ListSkeleton from '@/components/ListSkeleton';
import StatsDialog from '@/components/StatsDialog';
import BackupsDialog from '@/components/BackupsDialog';
import MoreMenu from '@/components/MoreMenu';
import FranchisesDialog from '@/components/FranchisesDialog';
import Toaster from '@/components/Toaster';
import EmptyState from '@/components/EmptyState';
import StarRating from '@/components/StarRating';
import { toast, dismissToast } from '@/lib/toast';
import { loadNotifications, markNotificationsRead } from '@/lib/notifications';
import { downloadListCsv } from '@/lib/exportList';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { canMorph, MORPH_NAME, trackTransition } from '@/lib/viewTransition';
import { franchisesWithOrder, loadOrders, orderedItems } from '@/lib/watchOrder';
import { loadHidden, resetHidden } from '@/lib/hiddenSuggestions';
import { fetchAll } from '@/lib/fetchAll';

const byName = (a, b) => a.name.localeCompare(b.name, 'hu');

const TOAST_THUMB = 'https://image.tmdb.org/t/p/w92';

// franchise-szűrő: '' = összes, NO_FRANCHISE = franchise nélküliek, egyébként franchise id
const NO_FRANCHISE = 'none';

// ennél szélesebb képernyőn választható a soros (táblázatos) nézet és a borítófal, alatta
// mindig borítófal
const DESKTOP_QUERY = '(min-width: 1400px)';
const PHONE_QUERY = '(max-width: 640px)'; // telefonos nézet

const PAGE_SIZE = 25; // ennyi cím egy oldalon (lista, telefon, keskenyebb rács)
// asztali rácsban (≥ 1400 px): 1440p-n (2560 px) 11 kártya fér egy sorba → 2 teli sor, és a
// lapozó görgetés nélkül is látszik (Norbi kérése)
const GRID_PAGE_SIZE = 22;

// asztali szélességen választható nézet: 'list' (táblázat) vagy 'grid' (borítófal); a böngésző
// megjegyzi (ha a tárhely nem érhető el, marad a lista)
const VIEW_KEY = 'filmlista-nezet';

function storedView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

const TYPES = [
  { code: 'movie', name: 'Filmek' },
  { code: 'tv', name: 'Sorozatok' },
];
// csak kiválasztott franchise vagy keresés mellett választható (akkor ez az alapértelmezés)
const BOTH_TYPES = { code: 'all', name: 'Filmek és sorozatok' };

const DOWNLOAD_FILTERS = [
  { code: 'all', name: 'Összes' },
  { code: 'yes', name: 'Letöltött' },
  { code: 'no', name: 'Nem letöltött' },
];

// a szűrők alapállapota (betöltéskor és a ↺ gombbal)
const DEFAULT_FILTERS = {
  type: 'movie',
  status: DEFAULT_STATUS,
  downloaded: 'no',
  genre: '',
  mama: '',
  franchise: NO_FRANCHISE,
};

// keresés közben minden cím látszik; a keresés előtti szűrők a keresés törlésekor visszaállnak
const SEARCH_FILTERS = {
  type: 'all',
  status: 'all',
  downloaded: 'all',
  genre: '',
  mama: '',
  franchise: '',
};

const sameFilters = (a, b) => Object.keys(a).every((k) => a[k] === b[k]);

// keresés: kis- és nagybetű, valamint ékezet nélkül hasonlít ("dune" → "Dűne")
const fold = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const byAddedDesc = (a, b) => new Date(b.created_at) - new Date(a.created_at);

// a teljes lista (legutóbb hozzáadott elöl): ezres adagokban, mert egy kérés legfeljebb 1000
// sort ad (lib/fetchAll.js); az id a rendezés egyértelműségéhez kell
const loadTitles = () =>
  fetchAll(() =>
    supabase
      .from('titles_with_genres')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
  );

// üres érték (nincs értékelés / megjelenési év) mindig a lista végére kerül;
// dir: -1 = csökkenő, 1 = növekvő
function nullsLast(x, y, dir) {
  if (x == null) return y == null ? 0 : 1;
  if (y == null) return -1;
  return dir * (x - y);
}

// egyezésnél a legutóbb hozzáadott van elöl
const SORTS = [
  { code: 'added_desc', name: 'Legutóbb hozzáadott', compare: byAddedDesc },
  { code: 'added_asc', name: 'Legkorábban hozzáadott', compare: (a, b) => -byAddedDesc(a, b) },
  {
    code: 'rating',
    name: 'Legjobb saját értékelés',
    compare: (a, b) => nullsLast(a.my_rating, b.my_rating, -1) || byAddedDesc(a, b),
  },
  {
    code: 'imdb',
    name: 'Legjobb IMDb-értékelés',
    compare: (a, b) => nullsLast(a.imdb_rating, b.imdb_rating, -1) || byAddedDesc(a, b),
  },
  {
    code: 'year_desc',
    name: 'Legújabb megjelenés',
    compare: (a, b) => nullsLast(a.release_year, b.release_year, -1) || byAddedDesc(a, b),
  },
  {
    code: 'year_asc',
    name: 'Legrégebbi megjelenés',
    compare: (a, b) => nullsLast(a.release_year, b.release_year, 1) || byAddedDesc(a, b),
  },
];

// franchise-ra szűrve, ha annak van saját nézési sorrendje (terv-3 28, Norbi döntése): a lista a
// sorrend tételeiből áll – a sorozat évadonként külön tétel, több helyen is szerepelhet –, és az
// állapot- és a letöltve-szűrő tételenként (évadnál az évadé) érvényes. Csak ilyenkor kínálja,
// és a franchise kiválasztásakor magától erre áll.
const WATCH_ORDER = { code: 'watch_order', name: 'Nézési sorrend' };

function Chip({ active, onClick, label, count }) {
  return (
    <button type="button" className="chip" aria-pressed={active} onClick={onClick}>
      {label}
      {count !== undefined && <span className="n">{count}</span>}
    </button>
  );
}

export default function Watchlist({ session }) {
  const [titles, setTitles] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [orders, setOrders] = useState([]); // a franchise-ok nézési sorrendjei (franchise_order sorai)
  const [loading, setLoading] = useState(true);
  // a franchise-logó keresése ezeknél már elindult ebben a munkamenetben
  const logoTried = useRef(new Set());
  const [loadError, setLoadError] = useState('');
  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState(''); // a „Cím hozzáadása” panel kezdő keresése
  const [showStats, setShowStats] = useState(false); // a statisztika ablak nyitva
  const [showFranchises, setShowFranchises] = useState(false); // a Franchise-ok ablak nyitva
  const [showBackups, setShowBackups] = useState(false); // a mentések ablak nyitva
  // a ⋮ menüből nyíló importok (a saját ablakukat / fájlválasztójukat nyitják)
  const imdbImportRef = useRef(null);
  const bulkImportRef = useRef(null);
  // a szerkesztő ablakban megnyitott cím (a lista sora, vagy egy TMDB-találat előnézete), vagy null
  const [editing, setEditing] = useState(null);
  // a borító, amelyről a szerkesztő nyílt: oda siklik vissza bezáráskor (nézetváltás)
  const editorFrom = useRef(null);

  // szerkesztő megnyitása: asztalon a kattintott borító átsiklik az ablak nagy borítójának
  // helyére (lib/viewTransition.js); egyébként egyszerűen megnyílik
  function openEditor(t, fromEl = null) {
    editorFrom.current = fromEl;
    if (!canMorph(fromEl)) {
      setEditing(t);
      return;
    }
    fromEl.style.viewTransitionName = MORPH_NAME;
    const transition = document.startViewTransition(() => {
      fromEl.style.viewTransitionName = '';
      flushSync(() => setEditing(t));
    });
    trackTransition(transition); // a szerkesztő nem sürgős frissítései megvárják a végét
  }
  const [notifications, setNotifications] = useState([]); // új évadokról, legutóbbi 30
  // itt már olvasottnak jelöltek: egy közben beérkező (korábban indult) lekérdezés se írja vissza
  // őket olvasatlannak
  const readIds = useRef(new Set());
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [view, setView] = useState(storedView); // a Watchlist csak a böngészőben fut

  function changeView(next) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // a választás így csak most érvényes
    }
  }

  // szűrők
  const [status, setStatus] = useState(DEFAULT_FILTERS.status);
  const [type, setType] = useState(DEFAULT_FILTERS.type);
  const [genre, setGenre] = useState(DEFAULT_FILTERS.genre);
  const [mama, setMama] = useState(DEFAULT_FILTERS.mama); // '' | interested | received
  const [franchise, setFranchise] = useState(DEFAULT_FILTERS.franchise);
  const [downloaded, setDownloaded] = useState(DEFAULT_FILTERS.downloaded); // all | yes | no
  const [sort, setSort] = useState('added_desc');
  // nézési sorrendes franchise-nál arra áll (amíg a felhasználó mást nem választ)
  const [orderSort, setOrderSort] = useState(true);
  const [query, setQuery] = useState(''); // keresés a felvett címek között
  const [beforeSearch, setBeforeSearch] = useState(null); // a keresés előtti szűrők
  const [filtersOpen, setFiltersOpen] = useState(false); // telefonon alapból összecsukva
  const filters = { type, status, downloaded, genre, mama, franchise };

  function applyFilters(f) {
    setType(f.type);
    setStatus(f.status);
    setDownloaded(f.downloaded);
    setGenre(f.genre);
    setMama(f.mama);
    setFranchise(f.franchise);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [titlesRes, statusesRes, franchisesRes] = await Promise.all([
        loadTitles(),
        supabase.from('statuses').select('*').order('sort_order'),
        supabase.from('franchises').select('id, name, logo_path, tmdb_collection_ids'),
      ]);
      if (cancelled) return;

      const error = titlesRes.error || statusesRes.error || franchisesRes.error;
      if (error) {
        console.error(error);
        setLoadError(
          'Nem sikerült betölteni a listát. Ellenőrizd a .env.local beállításait, és hogy fut-e a Supabase projekt.'
        );
      } else {
        setTitles(titlesRes.data);
        setStatuses(statusesRes.data);
        setFranchises(franchisesRes.data.sort(byName));
        loadOrders()
          .then((rows) => !cancelled && setOrders(rows))
          .catch((err) => console.warn('Nézési sorrendek betöltése sikertelen:', err.message));
        // „Nem érdekel” – elrejtett ajánlások (a Felfedezés és a Hasonló címek szűri)
        loadHidden().catch((err) => console.warn('Elrejtett ajánlások betöltése sikertelen:', err.message));

        // hiányzó / régi IMDb-értékelések pótlása a háttérben; hiba esetén csak a konzolba ír
        refreshImdbRatings(titlesRes.data, (rows) => {
          if (cancelled) return;
          const byId = new Map(rows.map((r) => [r.id, r]));
          setTitles((ts) => ts.map((t) => (byId.has(t.id) ? { ...t, ...byId.get(t.id) } : t)));
        }).catch((err) => console.warn('IMDb-értékelések frissítése sikertelen:', err.message));

        // a szerkesztő ablak háttérképei a háttérben (a még meg nem nézett címekhez)
        refreshBackdrops(titlesRes.data, (rows) => {
          if (cancelled) return;
          const byId = new Map(rows.map((r) => [r.id, r]));
          setTitles((ts) => ts.map((t) => (byId.has(t.id) ? { ...t, ...byId.get(t.id) } : t)));
        }).catch((err) => console.warn('Háttérképek lekérése sikertelen:', err.message));

        // sorozatok évadai a háttérben: a még évad nélküliek megkapják, a hetente
        // ellenőrzöttekhez az új (megjelent / bejelentett) évad felkerül
        // értesítések: rögtön, és az évad- / megjelenésfrissítés után újra, ha az változtatott
        // valamit (az új évadokról, digitális megjelenésről is szóljon; ha nem változott semmi,
        // az újratöltés ugyanazt adná – 3 adatbázis-kérés megspórolva). Hibánál is újratölt
        // (egy korábbi adag addig már frissülhetett).
        // (kilépés után már nem: a háttérfrissítések végén bejelentkezés nélkül futna)
        const reloadNotifications = () =>
          !cancelled &&
          loadNotifications()
            .then(
              (ns) =>
                !cancelled &&
                setNotifications(
                  ns.map((n) =>
                    !n.read_at && readIds.current.has(n.id) ? { ...n, read_at: new Date().toISOString() } : n
                  )
                )
            )
            .catch((err) => console.warn(err.message));
        reloadNotifications();

        refreshSeasons(titlesRes.data, (rows) => {
          if (cancelled) return;
          const byId = new Map(rows.map((r) => [r.id, r]));
          setTitles((ts) => ts.map((t) => byId.get(t.id) ?? t));
        }).then(
          (count) => count > 0 && reloadNotifications(),
          (err) => {
            console.warn('Évadok frissítése sikertelen:', err.message);
            reloadNotifications();
          }
        );

        // filmek megjelenési dátumai a háttérben (a még meg nem jelent filmek jelvényéhez); ha
        // közben valamelyik digitálisan megjelent, a harang is szól róla
        refreshReleases(titlesRes.data, (rows) => {
          if (cancelled) return;
          const byId = new Map(rows.map((r) => [r.id, r]));
          setTitles((ts) => ts.map((t) => (byId.has(t.id) ? { ...t, ...byId.get(t.id) } : t)));
        }).then(
          (count) => count > 0 && reloadNotifications(),
          (err) => {
            console.warn('Megjelenési dátumok frissítése sikertelen:', err.message);
            reloadNotifications();
          }
        );
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
      resetHidden();
    };
  }, []);

  // a kiválasztott típus (filmek / sorozatok) címei
  const ofType = useMemo(
    () => (type === 'all' ? titles : titles.filter((t) => t.media_type === type)),
    [titles, type]
  );
  const franchiseChosen = franchise !== '' && franchise !== NO_FRANCHISE;

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
  const usedFranchises = useMemo(() => {
    const used = new Set(titles.map((t) => t.franchise_id));
    return franchises.filter((f) => used.has(f.id));
  }, [titles, franchises]);

  const franchiseName = useMemo(
    () => new Map(franchises.map((f) => [f.id, f.name])),
    [franchises]
  );

  const mamaUsed = useMemo(() => titles.some((t) => t.mama_status), [titles]);

  // a telepített app ikonján (pl. a tálcán) is látszik az olvasatlan értesítések száma,
  // ahol a böngésző tudja (Chrome / Edge)
  const unreadCount = notifications.filter((n) => !n.read_at).length;
  useEffect(() => {
    try {
      const badge = unreadCount ? navigator.setAppBadge?.(unreadCount) : navigator.clearAppBadge?.();
      badge?.catch(() => {});
    } catch {
      // nincs ilyen lehetőség: semmi baj
    }
  }, [unreadCount]);

  // a harang kinyitásakor minden olvasott (az adatbázisban is)
  function readNotifications() {
    const now = new Date().toISOString();
    for (const n of notifications) if (!n.read_at) readIds.current.add(n.id);
    setNotifications((ns) => ns.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    markNotificationsRead();
  }

  // visszaállítás (Mentések) után: a lista, a franchise-ok és az értesítések újra az adatbázisból
  async function reloadAfterRestore() {
    const [titlesRes, franchisesRes] = await Promise.all([
      loadTitles(),
      supabase.from('franchises').select('id, name, logo_path, tmdb_collection_ids'),
    ]);
    const error = titlesRes.error || franchisesRes.error;
    if (error) {
      console.error(error);
      throw new Error('A visszaállítás sikerült, de a lista nem töltődött be. Frissítsd az oldalt.');
    }
    setTitles(titlesRes.data);
    setFranchises(franchisesRes.data.sort(byName));
    loadOrders()
      .then(setOrders)
      .catch((err) => console.warn(err.message));
    loadHidden().catch((err) => console.warn(err.message));
    loadNotifications()
      .then(setNotifications)
      .catch((err) => console.warn(err.message));
  }

  // a keresőben ezek alapján látszik, mi van már a listán
  const existingKeys = useMemo(() => new Set(titles.map(titleKey)), [titles]);

  // keresés a címben és az eredeti címben; több szónál mindegyiknek szerepelnie kell
  const words = useMemo(() => fold(query).split(/\s+/).filter(Boolean), [query]);
  const searching = words.length > 0;
  const searchText = useMemo(
    () => new Map(titles.map((t) => [t.id, fold(`${t.title} ${t.original_title ?? ''}`)])),
    [titles]
  );

  // minden szűrő az állapot és a letöltve kivételével
  const baseFiltered = useMemo(
    () =>
      ofType.filter(
        (t) =>
          (!genre || (t.genres ?? []).includes(genre)) &&
          (!mama || t.mama_status === mama) &&
          (!franchise ||
            (franchise === NO_FRANCHISE
              ? t.franchise_id == null
              : String(t.franchise_id) === franchise)) &&
          words.every((w) => searchText.get(t.id).includes(w))
      ),
    [ofType, genre, mama, franchise, words, searchText]
  );

  // minden szűrő az állapot kivételével – ebből jönnek az állapotgombok darabszámai
  const beforeStatus = useMemo(
    () => baseFiltered.filter((t) => downloaded === 'all' || t.is_downloaded === (downloaded === 'yes')),
    [baseFiltered, downloaded]
  );

  // nézési sorrend: csak ha a kiválasztott franchise-nak van saját sorrendje
  const orderFranchises = useMemo(() => franchisesWithOrder(titles, orders), [titles, orders]);
  const orderAvailable = franchiseChosen && orderFranchises.has(Number(franchise));
  const activeSort = orderAvailable && orderSort ? WATCH_ORDER.code : sort;
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

  // az "Abbahagyva" csak sorozatnál fordulhat elő: a Filmek nézetben nincs gombja
  const shownStatuses = useMemo(
    () => (type === 'movie' ? statuses.filter((s) => s.code !== DROPPED_STATUS) : statuses),
    [statuses, type]
  );

  const countByStatus = useMemo(() => {
    const counts = {};
    for (const t of itemsBeforeStatus ?? beforeStatus) counts[t.status] = (counts[t.status] ?? 0) + 1;
    return counts;
  }, [itemsBeforeStatus, beforeStatus]);

  // ha a szűrés vagy a rendezés változik (más kulcs): 1. oldal, és a megtartott sorok elengedve
  const filterKey = [type, status, genre, mama, franchise, downloaded, activeSort, words.join(' ')].join('|');

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
    const { compare } = SORTS.find((s) => s.code === sort);
    const matching = beforeStatus.filter((t) => status === 'all' || t.status === status);
    const ids = new Set(matching.map((t) => t.id));
    const stayed = ofType.filter((t) => keptIds.has(t.id) && !ids.has(t.id));
    return [...matching, ...stayed].sort(compare).map((t) => ({ key: t.id, title: t, item: null }));
  }, [itemsBeforeStatus, orderList, keptItems, statusNames, beforeStatus, ofType, keptIds, status, sort]);

  // hiányzó franchise-logók (a franchise első filmjének címlogója) a háttérben: betöltéskor, és
  // rögtön, amikor egy logó nélküli franchise-hoz az első cím bekerül (gyűjtemény, adatlap, sor,
  // tömeges import) – nem csak a következő betöltéskor. Kis várakozással, hogy az egymás után
  // felvett címek egy kérésbe essenek; franchise-onként munkamenetenként egyszer (ha a TMDB-n nincs
  // logó, a szerver 7 napig nem próbálja újra).
  const logoDue = loading
    ? ''
    : (() => {
        const used = new Set(titles.map((t) => t.franchise_id).filter(Boolean));
        return franchises
          .filter((f) => !f.logo_path && used.has(f.id) && !logoTried.current.has(f.id))
          .map((f) => f.id)
          .join(',');
      })();
  useEffect(() => {
    if (!logoDue) return;
    const timer = setTimeout(() => {
      for (const id of logoDue.split(',')) logoTried.current.add(Number(id));
      refreshFranchiseLogos()
        .then((rows) => {
          if (rows.length === 0) return;
          const byId = new Map(rows.map((r) => [r.id, r.logo_path]));
          setFranchises((fs) => fs.map((f) => (byId.has(f.id) ? { ...f, logo_path: byId.get(f.id) } : f)));
        })
        .catch((err) => console.warn('Franchise-logók lekérése sikertelen:', err.message));
    }, 1500);
    return () => clearTimeout(timer);
  }, [logoDue]);

  // lapozás: az oldal első címének helyét jegyezzük meg (first), így nézetváltáskor (más
  // oldalméret) az az oldal jön, amelyiken az addig látott első cím van
  const pageSize = isDesktop && view === 'grid' ? GRID_PAGE_SIZE : PAGE_SIZE;
  const [pageState, setPageState] = useState({ key: filterKey, first: 0 });
  // szűrés- / rendezésváltáskor 1. oldal (akkor is, ha később ugyanez a szűrés jön vissza)
  if (pageState.key !== filterKey) setPageState({ key: filterKey, first: 0 });
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const first = pageState.key === filterKey ? pageState.first : 0;
  const page = Math.min(Math.floor(first / pageSize) + 1, pageCount);
  const paged = visible.slice((page - 1) * pageSize, page * pageSize);
  const filtersRef = useRef(null);
  // a szűrősor eredeti helye: lapozáskor ide görget (a letapadt szűrősorhoz nem lehetne)
  const filtersAnchorRef = useRef(null);
  const [filtersStuck, setFiltersStuck] = useState(false);
  // telefonon a lebegő "+" gomb lefelé görgetéskor elhúzódik, felfelé visszajön
  const [fabHidden, setFabHidden] = useState(false);
  const lastScrollY = useRef(0);

  // a szűrősor görgetéskor a lap tetejére tapad: letapadva üveghatású ([data-stuck]); a
  // magasságát (--filters-h) a táblázat ragadós fejléce kapja, hogy alatta tapadjon
  const listShown = !loading && !loadError;
  useEffect(() => {
    const el = filtersRef.current;
    if (!el) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const y = window.scrollY;
      setFiltersStuck(y > 0 && el.getBoundingClientRect().top <= 0.5);
      if (y <= 240 || y < lastScrollY.current - 6) setFabHidden(false);
      else if (y > lastScrollY.current + 6) setFabHidden(true);
      lastScrollY.current = y;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    const resize = new ResizeObserver(() => {
      document.documentElement.style.setProperty('--filters-h', `${el.offsetHeight}px`);
      onScroll();
    });
    resize.observe(el);
    check();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [listShown]);

  function changePage(p) {
    setPageState({ key: filterKey, first: (p - 1) * pageSize });
    filtersAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function changeType(code) {
    setType(code);
    setGenre(''); // a filmek és sorozatok műfajai eltérnek
    if (code === 'movie' && status === DROPPED_STATUS) setStatus('all');
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
    if (status === DROPPED_STATUS) setStatus('all');
  }

  // franchise kiválasztásakor alapból a filmek és a sorozatok is látszanak;
  // ha a franchise-szűrő megszűnik (és nincs keresés), újra Filmek
  function changeFranchise(value) {
    setFranchise(value);
    setOrderSort(true);
    if (value !== '' && value !== NO_FRANCHISE) {
      setType('all');
      setGenre('');
    } else if (type === 'all' && !searching) {
      backToMovies();
    }
  }

  // gépeléskor az egész listán keres (a szűrők félreállnak, keresés közben szűkíthető); a
  // keresés törlésekor visszaállnak a keresés előtti szűrők
  function changeQuery(value) {
    const nowSearching = fold(value).trim() !== '';
    setQuery(value);
    if (nowSearching && !searching) {
      setBeforeSearch(filters);
      applyFilters(SEARCH_FILTERS);
    } else if (!nowSearching && searching) {
      applyFilters(beforeSearch ?? DEFAULT_FILTERS);
      setBeforeSearch(null);
    }
  }

  // a Franchise-ok ablakból („Szűrés erre”): a lista ennek a franchise-nak minden címét mutatja
  // (a többi szűrő elenged, a keresés törlődik), a lista elejére görget
  function showFranchise(id) {
    setQuery('');
    setBeforeSearch(null);
    applyFilters({ ...SEARCH_FILTERS, franchise: String(id) });
    setOrderSort(true);
    setShowFranchises(false);
    filtersAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleCreateFranchise(name) {
    const created = await createFranchise(name);
    setFranchises((fs) => [...fs, created].sort(byName));
    return created;
  }

  async function handleRenameFranchise(id, name) {
    const renamed = await renameFranchise(id, name);
    setFranchises((fs) => fs.map((f) => (f.id === id ? { ...f, name: renamed.name } : f)).sort(byName));
  }

  async function handleDeleteFranchise(id) {
    await deleteFranchise(id);
    setFranchises((fs) => fs.filter((f) => f.id !== id));
    setOrders((os) => os.filter((o) => o.franchise_id !== id));
    // az adatbázis már üresre állította a címeknél, itt csak helyben követjük
    setTitles((ts) => ts.map((t) => (t.franchise_id === id ? { ...t, franchise_id: null } : t)));
    if (franchise === String(id)) changeFranchise('');
    setBeforeSearch((b) => (b?.franchise === String(id) ? { ...b, franchise: '' } : b));
  }

  // a nyitott szerkesztő ablak is a friss sort kapja (pl. évadok változása után); a sor a
  // szűrés változásáig a helyén marad
  function replaceTitle(row) {
    setTitles((ts) => ts.map((x) => (x.id === row.id ? row : x)));
    // nézési sorrendben a cím most látható tételei maradnak a helyükön
    const items = visible.filter((e) => e.item && e.title.id === row.id).map((e) => e.key);
    setKept((k) => ({
      key: filterKey,
      ids: k.key === filterKey ? [...new Set([...k.ids, row.id])] : [row.id],
      items: k.key === filterKey ? [...new Set([...k.items, ...items])] : items,
    }));
    // más franchise-ba került: a régi sorrendből kikerült (az adatbázis-trigger is ezt teszi)
    setOrders((os) =>
      os.some((o) => o.title_id === row.id && o.franchise_id !== row.franchise_id)
        ? os.filter((o) => o.title_id !== row.id || o.franchise_id === row.franchise_id)
        : os
    );
  }

  // a franchise nézési sorrendje mentve (rows: az új sorok; üres: megjelenés szerint)
  function handleOrderChanged(franchiseId, rows) {
    setOrders((os) => [...os.filter((o) => o.franchise_id !== franchiseId), ...rows]);
  }

  // az IMDb-importból beírt csillagok helyben is
  function applyRatingsLocally(changes) {
    const byId = new Map(changes.map((c) => [c.id, c.to]));
    setTitles((ts) => ts.map((t) => (byId.has(t.id) ? { ...t, my_rating: byId.get(t.id) } : t)));
  }

  // törlés visszavonással: a cím azonnal lekerül, az adatbázisból csak a sáv lejártakor (8 mp)
  // vagy a × gombra törlődik; „Visszavonás”: vissza a listára. Ha a lapot közben bezárják, a cím
  // megmarad (biztonságos hiba).
  function requestDelete(t) {
    setTitles((ts) => ts.filter((x) => x.id !== t.id));
    const restore = () => setTitles((ts) => (ts.some((x) => x.id === t.id) ? ts : [t, ...ts]));
    toast({
      text: (
        <>
          „<b>{t.title}</b>” lekerült a listáról
        </>
      ),
      action: { label: 'Visszavonás', onClick: restore },
      onExpire: () =>
        deleteTitle(t.id).catch((err) => {
          restore();
          toast({ text: `Nem sikerült törölni: „${t.title}”. ${err.message}` });
        }),
    });
  }

  // a táblázatban (sor vagy évadok) Megnézve-re váltott, még értékelés nélküli címnél
  // megkérdezzük, hogy tetszett (a szerkesztő ablakban nem: ott a csillagsor kéznél van).
  // A sor kétszer jön (azonnal, majd a mentett): a ref már az elsőt látja, így csak egyszer kérdez.
  const titlesRef = useRef(titles);
  useEffect(() => {
    titlesRef.current = titles;
  }, [titles]);

  // ask: false – a gyűjtemény-ablak nézési sorrendjéből (az ablak alatt a sáv nem kattintható,
  // ott a tétel alatt kérdez)
  function handleRowUpdated(row, ask = true) {
    const before = titlesRef.current.find((x) => x.id === row.id);
    if (ask && before && before.status !== 'watched' && row.status === 'watched' && !row.my_rating) {
      askRating(row);
    }
    titlesRef.current = titlesRef.current.map((x) => (x.id === row.id ? row : x));
    replaceTitle(row);
  }

  function askRating(t) {
    let id = 0;
    const rate = async (n) => {
      dismissToast(id);
      try {
        replaceTitle(await updateTitle(t.id, { my_rating: n }));
      } catch (err) {
        toast({ text: err.message });
      }
    };
    id = toast({
      image: t.poster_path ? TOAST_THUMB + t.poster_path : null,
      text: (
        <>
          Megnézted: <b>{t.title}</b>. Hogy tetszett?
        </>
      ),
      content: <StarRating name={`ask-${t.id}`} label={`Értékelés – ${t.title}`} value={null} onChange={rate} />,
      action: { label: 'Később', onClick: () => {} },
      hideClose: true,
    });
  }

  // a „Cím hozzáadása” panel (opcionálisan kitöltött kereséssel), a lap tetején
  function openAdd(q = '') {
    setAddQuery(q);
    setAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // a telefonos "Szűrők" gomb rövid összegzése, pl. "Filmek · Megnézendő · Nem letöltött ·
  // Franchise nélkül"
  const filterSummary = [
    (type === 'all' ? BOTH_TYPES : TYPES.find((t) => t.code === type))?.name,
    status === 'all' ? 'Minden állapot' : statuses.find((s) => s.code === status)?.name,
    downloaded !== 'all' && DOWNLOAD_FILTERS.find((d) => d.code === downloaded)?.name,
    genre,
    mama && `Mama: ${mamaLabel(mama)}`,
    franchise === NO_FRANCHISE
      ? usedFranchises.length > 0 && 'Franchise nélkül'
      : franchise && franchiseName.get(Number(franchise)),
  ]
    .filter(Boolean)
    .join(' · ');

  // ↺: a szűrők alapállapota, keresés nélkül
  const atDefault = !searching && sameFilters(filters, DEFAULT_FILTERS);

  function resetToDefault() {
    setQuery('');
    setBeforeSearch(null);
    applyFilters(DEFAULT_FILTERS);
  }

  // "Szűrők törlése" üres találatnál: minden cím látszik. Keresés közben a keresés marad; anélkül
  // a típus is (a "Filmek és sorozatok" csak franchise-szal választható, abból Filmek lesz).
  function clearFilters() {
    applyFilters(searching ? SEARCH_FILTERS : { ...SEARCH_FILTERS, type: type === 'all' ? 'movie' : type });
  }

  return (
    <main>
      <header className="top">
        <div>
          <h1 className="brand">Megnézendő filmek és sorozatok</h1>
          {!loading && !loadError && (
            <p className="count">{titles.length} cím a listán</p>
          )}
        </div>
        <div className="account">
          {!loading && !loadError && (
            <button
              type="button"
              className="primary"
              aria-expanded={adding}
              aria-controls="add-panel"
              onClick={() => (adding ? setAdding(false) : openAdd())}
            >
              Cím hozzáadása
            </button>
          )}
          {!loading && !loadError && (
            <NotificationBell
              notifications={notifications}
              titles={titles}
              onOpenTitle={(t) => openEditor(t)}
              onRead={readNotifications}
            />
          )}
          <span className="muted small">{session.user.email}</span>
          <button type="button" className="ghost" onClick={() => supabase.auth.signOut()}>
            Kilépés
          </button>
          {/* a ritkábban használt műveletek a ⋮ menüben (mint a Chrome-ban); a tömeges import és
              a mentés csak asztali nézetben */}
          {!loading && !loadError && (
            <>
              <MoreMenu
                items={[
                  {
                    id: 'stats',
                    label: 'Statisztika',
                    description: 'Havonta megnézett címek, műfajok, átlagos értékelés',
                    icon: 'chart',
                    onSelect: () => setShowStats(true),
                  },
                  {
                    id: 'franchises',
                    label: 'Franchise-ok',
                    description: 'Az összes franchise logóval, ábécérendben; gyűjtemény, szűrés, átnevezés',
                    icon: 'stack',
                    onSelect: () => setShowFranchises(true),
                  },
                  // a CSV-fájl betöltése asztali / tableten végzett teendő: telefonon nincs (Norbi kérése)
                  ...(isPhone
                    ? []
                    : [
                        {
                          id: 'imdb',
                          label: 'IMDb import',
                          description: 'Az IMDb-értékeléseid vagy a figyelőlistád (Watchlist) CSV-exportjából: csillagok, új címek',
                          icon: 'star',
                          onSelect: () => imdbImportRef.current?.open(),
                        },
                      ]),
                  ...(isDesktop
                    ? [
                        {
                          id: 'bulk',
                          label: 'Tömeges import',
                          description: 'Sok cím felvétele egyszerre, soronként egy címmel',
                          icon: 'list',
                          onSelect: () => bulkImportRef.current?.open(),
                        },
                        {
                          id: 'export',
                          label: 'Mentés letöltése',
                          description: `A teljes lista (${titles.length} cím) CSV-fájlba – Excelben megnyitható`,
                          icon: 'download',
                          onSelect: () => downloadListCsv(titles, franchiseName),
                        },
                      ]
                    : []),
                  {
                    id: 'backups',
                    label: 'Mentések',
                    description: 'Heti automatikus mentés; mentés most, visszaállítás',
                    icon: 'history',
                    onSelect: () => setShowBackups(true),
                  },
                ]}
              />
              <ImdbRatingsImport
                ref={imdbImportRef}
                titles={titles}
                onApplied={applyRatingsLocally}
                onAdded={(row) => setTitles((ts) => [row, ...ts])}
              />
              {isDesktop && (
                <BulkImport
                  ref={bulkImportRef}
                  existingKeys={existingKeys}
                  onAdded={(row) => setTitles((ts) => [row, ...ts])}
                />
              )}
            </>
          )}
        </div>
      </header>

      {/* betöltés közben csontváz: a nézetnek megfelelő sorok / kártyák körvonala */}
      {loading && <ListSkeleton table={isDesktop && view === 'list'} />}
      {loadError && (
        <p className="state error" role="alert">
          {loadError}
        </p>
      )}

      {!loading && !loadError && (
        <>
          {adding && (
            <TitleSearch
              key={addQuery}
              initialQuery={addQuery}
              existingKeys={existingKeys}
              onAdded={(row) => setTitles((ts) => [row, ...ts])}
              onPreview={openEditor}
              onClose={() => setAdding(false)}
            />
          )}

          <div ref={filtersAnchorRef} aria-hidden="true" />
          <section
            className={filtersOpen ? 'filters open' : 'filters'}
            aria-label="Szűrők"
            ref={filtersRef}
            data-stuck={filtersStuck ? '' : undefined}
          >
            {/* telefonon a szűrők alapból összecsukva: a gomb röviden mutatja a beállítást,
                kinyitva minden szűrő és a rendezés látszik (a kereső mindig) */}
            <button
              type="button"
              className="filters-toggle"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((o) => !o)}
            >
              <b>Szűrők</b>
              <span className="filters-summary">{filterSummary}</span>
              <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>

            <select
              className="type-select"
              aria-label="Típus"
              value={type}
              onChange={(e) => changeType(e.target.value)}
            >
              {(franchiseChosen || searching ? [BOTH_TYPES, ...TYPES] : TYPES).map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>

            {/* mobilon az állapotgombok helyett lenyíló (CSS kapcsolja), a típus mellett */}
            <select
              className="status-select"
              aria-label="Állapot"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Minden állapot ({(itemsBeforeStatus ?? beforeStatus).length})</option>
              {shownStatuses.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({countByStatus[s.code] ?? 0})
                </option>
              ))}
            </select>

            <div className="filter-group">
              <div className="chips status-chips" role="group" aria-label="Állapot">
                <Chip
                  active={status === 'all'}
                  onClick={() => setStatus('all')}
                  label="Mind"
                  count={(itemsBeforeStatus ?? beforeStatus).length}
                />
                {shownStatuses.map((s) => (
                  <Chip
                    key={s.code}
                    active={status === s.code}
                    onClick={() => setStatus(s.code)}
                    label={s.name}
                    count={countByStatus[s.code] ?? 0}
                  />
                ))}
              </div>

              <label className="inline-field">
                Letöltés
                <select value={downloaded} onChange={(e) => setDownloaded(e.target.value)}>
                  {DOWNLOAD_FILTERS.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {genres.length > 0 && (
              <label className="inline-field">
                Műfaj
                <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                  <option value="">Összes</option>
                  {genres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* csak ha van a listán Mama-jelölés */}
            {(mamaUsed || mama) && (
              <label className="inline-field">
                Mama
                <select value={mama} onChange={(e) => setMama(e.target.value)}>
                  <option value="">Összes</option>
                  {MAMA_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {/* a Franchise és mellette az alaphelyzet gomb együtt törik új sorba */}
            <div className="filter-end">
              {usedFranchises.length > 0 && (
                <div className="inline-field">
                  <span id="franchise-filter-label">Franchise</span>
                  <FranchiseFilter
                    labelId="franchise-filter-label"
                    value={franchise}
                    onChange={changeFranchise}
                    options={[
                      { value: '', label: 'Összes' },
                      { value: NO_FRANCHISE, label: 'Franchise nélkül' },
                      ...usedFranchises.map((f) => ({
                        value: String(f.id),
                        label: f.name,
                        logo: f.logo_path,
                      })),
                    ]}
                  />
                </div>
              )}

              {/* alaphelyzet gomb: felirat nélkül, rámutatva súgó; alapállapotban halvány */}
              <span className="has-hint filter-reset-wrap">
                <button
                  type="button"
                  className="filter-reset"
                  aria-label="Szűrők alaphelyzetbe"
                  aria-describedby="filter-reset-hint"
                  disabled={atDefault}
                  onClick={resetToDefault}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
                <span id="filter-reset-hint" role="tooltip" className="hint">
                  {atDefault ? 'A szűrők alaphelyzetben: ' : 'Szűrők alaphelyzetbe: '}
                  Filmek · Megnézendő · Nem letöltött · Összes műfaj · Franchise nélkül
                </span>
              </span>

              {/* letapadt szűrősorban (lejjebb görgetve) gyorsgombok: Cím hozzáadása, vissza a
                  lap tetejére – csak asztalon (telefonon ott a lebegő „+”) */}
              {filtersStuck && (
                <span className="stuck-tools">
                  <button
                    type="button"
                    className="primary"
                    aria-label="Cím hozzáadása"
                    title="Cím hozzáadása"
                    onClick={() => openAdd()}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    aria-label="Vissza a lap tetejére"
                    title="Vissza a lap tetejére"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </span>
              )}
            </div>

            {/* jobb szélen: keresés a felvett címek között, mellette a rendezés */}
            <div className="list-tools">
              <input
                type="search"
                className="list-search"
                aria-label="Keresés a listán"
                placeholder="Keresés a listán"
                value={query}
                onChange={(e) => changeQuery(e.target.value)}
              />
              <select
                aria-label="Rendezés"
                value={activeSort}
                onChange={(e) => {
                  if (e.target.value === WATCH_ORDER.code) {
                    setOrderSort(true);
                  } else {
                    setSort(e.target.value);
                    setOrderSort(false);
                  }
                }}
              >
                {(orderAvailable ? [WATCH_ORDER, ...SORTS] : SORTS).map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
              {/* lista / rács váltó felirat nélkül (keskenyebben mindig rács) */}
              {isDesktop && (
                <div className="view-toggle" role="group" aria-label="Nézet">
                  <button
                    type="button"
                    aria-label="Listás nézet"
                    title="Listás nézet"
                    aria-pressed={view === 'list'}
                    onClick={() => changeView('list')}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Rácsos nézet"
                    title="Rácsos nézet"
                    aria-pressed={view === 'grid'}
                    onClick={() => changeView('grid')}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
                      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
                      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
                      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* franchise-ra szűrve: a gyűjtemény sávja (hány címét láttad; az ablakban a TMDB-gyűjtemények, a további címek, kézi hozzárendelés) */}
          {franchiseChosen && !searching && franchiseName.has(Number(franchise)) && (
            <FranchiseCollection
              key={franchise}
              franchise={franchises.find((f) => String(f.id) === franchise)}
              titles={titles}
              orders={orders}
              onAdded={(row) => setTitles((ts) => [row, ...ts])}
              onUpdated={(row) => handleRowUpdated(row, false)}
              onOrderChanged={handleOrderChanged}
              onFranchiseUpdated={(f) => setFranchises((fs) => fs.map((x) => (x.id === f.id ? { ...x, ...f } : x)))}
            />
          )}

          {titles.length === 0 ? (
            <EmptyState
              title="A listád még üres"
              text="Keress rá egy filmre vagy sorozatra, vagy válassz a népszerűek közül."
            >
              <button type="button" className="primary" onClick={() => openAdd()}>
                Első cím hozzáadása
              </button>
              {isDesktop && (
                <button type="button" className="ghost" onClick={() => bulkImportRef.current?.open()}>
                  Tömeges import
                </button>
              )}
            </EmptyState>
          ) : ofType.length === 0 ? (
            <EmptyState
              title={`Még nincs ${type === 'tv' ? 'sorozat' : 'film'} a listádon`}
              text="Váltsd át a típust, vagy adj hozzá egyet."
            >
              <button type="button" className="primary" onClick={() => openAdd()}>
                {type === 'tv' ? 'Sorozat' : 'Film'} hozzáadása
              </button>
              <button type="button" className="ghost" onClick={() => changeType(type === 'tv' ? 'movie' : 'tv')}>
                {type === 'tv' ? 'Filmek' : 'Sorozatok'} mutatása
              </button>
            </EmptyState>
          ) : visible.length === 0 && searching ? (
            // a keresés a listán nem talált: egy kattintással a TMDB-n keres tovább
            <EmptyState
              title={`Nincs „${query.trim()}” a listádon`}
              text={
                sameFilters(filters, SEARCH_FILTERS)
                  ? 'A címekben és az eredeti címekben kerestem, a szűrőktől függetlenül.'
                  : `A címekben és az eredeti címekben kerestem, ezzel a szűréssel: ${filterSummary}.`
              }
            >
              <button type="button" className="primary" onClick={() => openAdd(query.trim())}>
                Keresés a TMDB-n: „{query.trim()}”
              </button>
              {sameFilters(filters, SEARCH_FILTERS) ? (
                <button type="button" className="ghost" onClick={() => changeQuery('')}>
                  Keresés törlése
                </button>
              ) : (
                <button type="button" className="ghost" onClick={clearFilters}>
                  Szűrők törlése
                </button>
              )}
            </EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState title="Nincs a szűrésnek megfelelő cím" text={`Szűrés: ${filterSummary}.`}>
              <button type="button" className="primary" onClick={clearFilters}>
                Szűrők törlése
              </button>
              <button type="button" className="ghost" onClick={() => openAdd()}>
                Felfedezés
              </button>
            </EmptyState>
          ) : isDesktop && view === 'list' ? (
            <TitleTable
              entries={paged}
              statuses={statuses}
              franchises={franchises}
              onCreateFranchise={handleCreateFranchise}
              onDeleteFranchise={handleDeleteFranchise}
              onRenameFranchise={handleRenameFranchise}
              onEdit={openEditor}
              onUpdated={handleRowUpdated}
              onDelete={requestDelete}
            />
          ) : (
            <ul className="grid">
              {paged.map((e) => (
                <li key={e.key}>
                  <PosterCard
                    title={e.title}
                    item={e.item}
                    franchise={franchiseName.get(e.title.franchise_id)}
                    onEdit={openEditor}
                  />
                </li>
              ))}
            </ul>
          )}

          {ofType.length > 0 && (
            <Pagination
              page={page}
              pageCount={pageCount}
              total={visible.length}
              pageSize={pageSize}
              onChange={changePage}
              docked={isDesktop && view === 'grid'}
            />
          )}
        </>
      )}

      {showFranchises && (
        <FranchisesDialog
          franchises={franchises}
          titles={titles}
          orders={orders}
          onCreate={handleCreateFranchise}
          onRename={handleRenameFranchise}
          onDelete={handleDeleteFranchise}
          onShow={showFranchise}
          onAdded={(row) => setTitles((ts) => [row, ...ts])}
          onUpdated={(row) => handleRowUpdated(row, false)}
          onOrderChanged={handleOrderChanged}
          onFranchiseUpdated={(f) => setFranchises((fs) => fs.map((x) => (x.id === f.id ? { ...x, ...f } : x)))}
          onClose={() => setShowFranchises(false)}
        />
      )}
      {showStats && (
        <StatsDialog titles={titles} franchiseName={franchiseName} onClose={() => setShowStats(false)} />
      )}

      {showBackups && (
        <BackupsDialog
          titleCount={titles.length}
          onRestored={reloadAfterRestore}
          onClose={() => setShowBackups(false)}
        />
      )}

      {/* telefonon lebegő "+" gomb a fejléc "Cím hozzáadása" gombja helyett (a CSS csak
          640 px alatt mutatja); lefelé görgetéskor elhúzódik */}
      {!loading && !loadError && (
        <button
          type="button"
          className={fabHidden ? 'fab hidden' : 'fab'}
          aria-label="Cím hozzáadása"
          aria-expanded={adding}
          aria-controls="add-panel"
          onClick={() => openAdd()}
        >
          <svg
            viewBox="0 0 24 24"
            width="26"
            height="26"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {editing && (
        <TitleEditor
          title={editing}
          titles={titles}
          statuses={statuses}
          franchises={franchises}
          onCreateFranchise={handleCreateFranchise}
          onDeleteFranchise={handleDeleteFranchise}
          onRenameFranchise={handleRenameFranchise}
          existingKeys={existingKeys}
          onAdded={(row) => setTitles((ts) => [row, ...ts])}
          onSaved={replaceTitle}
          onChanged={replaceTitle}
          onDelete={requestDelete}
          morphTo={editorFrom.current}
          onClose={() => setEditing(null)}
        />
      )}

      <Toaster />
    </main>
  );
}
