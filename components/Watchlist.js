'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import PosterCard from '@/components/PosterCard';
import Pagination from '@/components/Pagination';
import ImdbRatingsImport from '@/components/ImdbRatingsImport';
import TitleSearch from '@/components/TitleSearch';
import TitleEditor from '@/components/TitleEditor';
import TitleTable from '@/components/TitleTable';
import {
  titleKey,
  createFranchise,
  deleteFranchise,
  renameFranchise,
  refreshImdbRatings,
  refreshFranchiseLogos,
  refreshSeasons,
  DEFAULT_STATUS,
  DROPPED_STATUS,
  MAMA_OPTIONS,
} from '@/lib/titles';
import FranchiseFilter from '@/components/FranchiseFilter';
import NotificationBell from '@/components/NotificationBell';
import BulkImport from '@/components/BulkImport';
import { loadNotifications, markNotificationsRead } from '@/lib/notifications';
import { downloadListCsv } from '@/lib/exportList';
import { useMediaQuery } from '@/lib/useMediaQuery';

const byName = (a, b) => a.name.localeCompare(b.name, 'hu');

// franchise-szűrő: '' = összes, NO_FRANCHISE = franchise nélküliek, egyébként franchise id
const NO_FRANCHISE = 'none';

// ennél szélesebb képernyőn választható a soros (táblázatos) nézet és a borítófal, alatta
// mindig borítófal
const DESKTOP_QUERY = '(min-width: 1400px)';

const PAGE_SIZE = 25; // ennyi cím egy oldalon

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // a szerkesztett cím, vagy null
  const [notifications, setNotifications] = useState([]); // új évadokról, legutóbbi 30
  // itt már olvasottnak jelöltek: egy közben beérkező (korábban indult) lekérdezés se írja vissza
  // őket olvasatlannak
  const readIds = useRef(new Set());
  const isDesktop = useMediaQuery(DESKTOP_QUERY);
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
  const [query, setQuery] = useState(''); // keresés a felvett címek között
  const [beforeSearch, setBeforeSearch] = useState(null); // a keresés előtti szűrők
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
        supabase
          .from('titles_with_genres')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('statuses').select('*').order('sort_order'),
        supabase.from('franchises').select('id, name, logo_path'),
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

        // hiányzó / régi IMDb-értékelések pótlása a háttérben; hiba esetén csak a konzolba ír
        refreshImdbRatings((rows) => {
          if (cancelled) return;
          const byId = new Map(rows.map((r) => [r.id, r]));
          setTitles((ts) => ts.map((t) => (byId.has(t.id) ? { ...t, ...byId.get(t.id) } : t)));
        }).catch((err) => console.warn('IMDb-értékelések frissítése sikertelen:', err.message));

        // sorozatok évadai a háttérben: a még évad nélküliek megkapják, a hetente
        // ellenőrzöttekhez az új (megjelent / bejelentett) évad felkerül
        // értesítések: rögtön, és az évadfrissítés után újra (az új évadokról is szóljon)
        const reloadNotifications = () =>
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

        refreshSeasons((rows) => {
          if (cancelled) return;
          const byId = new Map(rows.map((r) => [r.id, r]));
          setTitles((ts) => ts.map((t) => byId.get(t.id) ?? t));
        })
          .catch((err) => console.warn('Évadok frissítése sikertelen:', err.message))
          .finally(reloadNotifications);

        // hiányzó franchise-logók (a franchise első filmjének címlogója) a háttérben
        if (franchisesRes.data.some((f) => !f.logo_path)) {
          refreshFranchiseLogos()
            .then((rows) => {
              if (cancelled || rows.length === 0) return;
              const byId = new Map(rows.map((r) => [r.id, r.logo_path]));
              setFranchises((fs) =>
                fs.map((f) => (byId.has(f.id) ? { ...f, logo_path: byId.get(f.id) } : f))
              );
            })
            .catch((err) => console.warn('Franchise-logók lekérése sikertelen:', err.message));
        }
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
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

  // a keresőben ezek alapján látszik, mi van már a listán
  const existingKeys = useMemo(() => new Set(titles.map(titleKey)), [titles]);

  // keresés a címben és az eredeti címben; több szónál mindegyiknek szerepelnie kell
  const words = useMemo(() => fold(query).split(/\s+/).filter(Boolean), [query]);
  const searching = words.length > 0;
  const searchText = useMemo(
    () => new Map(titles.map((t) => [t.id, fold(`${t.title} ${t.original_title ?? ''}`)])),
    [titles]
  );

  // minden szűrő az állapot kivételével – ebből jönnek az állapotgombok darabszámai
  const beforeStatus = useMemo(
    () =>
      ofType.filter(
        (t) =>
          (!genre || (t.genres ?? []).includes(genre)) &&
          (!mama || t.mama_status === mama) &&
          (!franchise ||
            (franchise === NO_FRANCHISE
              ? t.franchise_id == null
              : String(t.franchise_id) === franchise)) &&
          (downloaded === 'all' || t.is_downloaded === (downloaded === 'yes')) &&
          words.every((w) => searchText.get(t.id).includes(w))
      ),
    [ofType, genre, mama, franchise, downloaded, words, searchText]
  );

  // az "Abbahagyva" csak sorozatnál fordulhat elő: a Filmek nézetben nincs gombja
  const shownStatuses = useMemo(
    () => (type === 'movie' ? statuses.filter((s) => s.code !== DROPPED_STATUS) : statuses),
    [statuses, type]
  );

  const countByStatus = useMemo(() => {
    const counts = {};
    for (const t of beforeStatus) counts[t.status] = (counts[t.status] ?? 0) + 1;
    return counts;
  }, [beforeStatus]);

  // ha a szűrés vagy a rendezés változik (más kulcs): 1. oldal, és a megtartott sorok elengedve
  const filterKey = [type, status, genre, mama, franchise, downloaded, sort, words.join(' ')].join('|');

  // a most szerkesztett címek a helyükön maradnak, amíg a szűrés nem változik: pl. a "Nem
  // letöltött" nézetben letöltöttnek jelölt film nem tűnik el azonnal (a pipa visszavehető)
  const [kept, setKept] = useState({ key: filterKey, ids: [] });
  // szűrésváltáskor elengedjük őket (akkor is, ha később ugyanez a szűrés jön vissza)
  if (kept.key !== filterKey) setKept({ key: filterKey, ids: [] });
  const keptIds = useMemo(() => new Set(kept.ids), [kept]);

  const visible = useMemo(() => {
    const { compare } = SORTS.find((s) => s.code === sort);
    const matching = beforeStatus.filter((t) => status === 'all' || t.status === status);
    const ids = new Set(matching.map((t) => t.id));
    const stayed = ofType.filter((t) => keptIds.has(t.id) && !ids.has(t.id));
    return [...matching, ...stayed].sort(compare);
  }, [beforeStatus, ofType, keptIds, status, sort]);

  // lapozás
  const [pageState, setPageState] = useState({ key: filterKey, page: 1 });
  // szűrés- / rendezésváltáskor 1. oldal (akkor is, ha később ugyanez a szűrés jön vissza)
  if (pageState.key !== filterKey) setPageState({ key: filterKey, page: 1 });
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = Math.min(pageState.key === filterKey ? pageState.page : 1, pageCount);
  const paged = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtersRef = useRef(null);

  function changePage(p) {
    setPageState({ key: filterKey, page: p });
    filtersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    // az adatbázis már üresre állította a címeknél, itt csak helyben követjük
    setTitles((ts) => ts.map((t) => (t.franchise_id === id ? { ...t, franchise_id: null } : t)));
    if (franchise === String(id)) changeFranchise('');
    setBeforeSearch((b) => (b?.franchise === String(id) ? { ...b, franchise: '' } : b));
  }

  // a nyitott szerkesztő ablak is a friss sort kapja (pl. évadok változása után); a sor a
  // szűrés változásáig a helyén marad
  function replaceTitle(row) {
    setTitles((ts) => ts.map((x) => (x.id === row.id ? row : x)));
    setEditing((e) => (e && e.id === row.id ? row : e));
    setKept((k) => ({
      key: filterKey,
      ids: k.key === filterKey ? [...new Set([...k.ids, row.id])] : [row.id],
    }));
  }

  // az IMDb-importból beírt csillagok helyben is
  function applyRatingsLocally(changes) {
    const byId = new Map(changes.map((c) => [c.id, c.to]));
    setTitles((ts) => ts.map((t) => (byId.has(t.id) ? { ...t, my_rating: byId.get(t.id) } : t)));
  }

  function removeTitle(id) {
    setTitles((ts) => ts.filter((x) => x.id !== id));
  }

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
              onClick={() => setAdding((a) => !a)}
            >
              Cím hozzáadása
            </button>
          )}
          {!loading && !loadError && (
            <NotificationBell
              notifications={notifications}
              titles={titles}
              onOpenTitle={setEditing}
              onRead={readNotifications}
            />
          )}
          <span className="muted small">{session.user.email}</span>
          {!loading && !loadError && (
            <ImdbRatingsImport titles={titles} onApplied={applyRatingsLocally} />
          )}
          {/* tömeges import és mentés: csak asztali nézetben */}
          {!loading && !loadError && isDesktop && (
            <>
              <BulkImport
                existingKeys={existingKeys}
                onAdded={(row) => setTitles((ts) => [row, ...ts])}
              />
              <span className="has-hint">
                <button
                  type="button"
                  className="subtle-link"
                  aria-describedby="export-hint"
                  onClick={() => downloadListCsv(titles, franchiseName)}
                >
                  Mentés letöltése
                </button>
                <span id="export-hint" role="tooltip" className="hint">
                  A teljes listát ({titles.length} cím) CSV-fájlba menti: Excelben megnyitható,
                  biztonsági mentésnek is jó.
                </span>
              </span>
            </>
          )}
          <button type="button" className="ghost" onClick={() => supabase.auth.signOut()}>
            Kilépés
          </button>
        </div>
      </header>

      {loading && <p className="state">Lista betöltése…</p>}
      {loadError && (
        <p className="state error" role="alert">
          {loadError}
        </p>
      )}

      {!loading && !loadError && (
        <>
          {adding && (
            <TitleSearch
              existingKeys={existingKeys}
              onAdded={(row) => setTitles((ts) => [row, ...ts])}
              onClose={() => setAdding(false)}
            />
          )}

          <section className="filters" aria-label="Szűrők" ref={filtersRef}>
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
              <option value="all">Minden állapot ({beforeStatus.length})</option>
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
                  count={beforeStatus.length}
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
              <select aria-label="Rendezés" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORTS.map((s) => (
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

          {titles.length === 0 ? (
            <p className="state">
              A listád még üres. Keress rá egy filmre vagy sorozatra a „Cím hozzáadása”
              gombbal.
            </p>
          ) : ofType.length === 0 ? (
            <p className="state">
              Még nincs {type === 'tv' ? 'sorozat' : 'film'} a listádon. Váltsd át a típust,
              vagy adj hozzá egyet a „Cím hozzáadása” gombbal.
            </p>
          ) : visible.length === 0 ? (
            <p className="state">
              {searching ? 'Nincs a keresésnek megfelelő cím.' : 'Nincs a szűrésnek megfelelő cím.'}{' '}
              {searching && sameFilters(filters, SEARCH_FILTERS) ? (
                <button type="button" className="link" onClick={() => changeQuery('')}>
                  Keresés törlése
                </button>
              ) : (
                <button type="button" className="link" onClick={clearFilters}>
                  Szűrők törlése
                </button>
              )}
            </p>
          ) : isDesktop && view === 'list' ? (
            <TitleTable
              titles={paged}
              statuses={statuses}
              franchises={franchises}
              onCreateFranchise={handleCreateFranchise}
              onDeleteFranchise={handleDeleteFranchise}
              onRenameFranchise={handleRenameFranchise}
              onEdit={setEditing}
              onUpdated={replaceTitle}
              onDeleted={removeTitle}
            />
          ) : (
            <ul className="grid">
              {paged.map((t) => (
                <li key={t.id}>
                  <PosterCard
                    title={t}
                    franchise={franchiseName.get(t.franchise_id)}
                    onEdit={setEditing}
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
              pageSize={PAGE_SIZE}
              onChange={changePage}
            />
          )}
        </>
      )}

      {editing && (
        <TitleEditor
          title={editing}
          statuses={statuses}
          franchises={franchises}
          onCreateFranchise={handleCreateFranchise}
          onDeleteFranchise={handleDeleteFranchise}
          onRenameFranchise={handleRenameFranchise}
          existingKeys={existingKeys}
          onAdded={(row) => setTitles((ts) => [row, ...ts])}
          onSaved={replaceTitle}
          onChanged={replaceTitle}
          onDeleted={removeTitle}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}
