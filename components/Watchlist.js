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
  refreshImdbRatings,
  refreshFranchiseLogos,
  refreshSeasons,
} from '@/lib/titles';
import FranchiseFilter from '@/components/FranchiseFilter';
import { useMediaQuery } from '@/lib/useMediaQuery';

const byName = (a, b) => a.name.localeCompare(b.name, 'hu');

// franchise-szűrő: '' = összes, NO_FRANCHISE = franchise nélküliek, egyébként franchise id
const NO_FRANCHISE = 'none';

// ennél szélesebb képernyőn soros (táblázatos) nézet, alatta borítófal
const DESKTOP_QUERY = '(min-width: 1400px)';

const PAGE_SIZE = 25; // ennyi cím egy oldalon

const TYPES = [
  { code: 'movie', name: 'Filmek' },
  { code: 'tv', name: 'Sorozatok' },
];
// csak kiválasztott franchise vagy keresés mellett választható (akkor ez az alapértelmezés)
const BOTH_TYPES = { code: 'all', name: 'Filmek és sorozatok' };

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
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  // szűrők
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('movie');
  const [genre, setGenre] = useState('');
  const [franchise, setFranchise] = useState(''); // '' = összes, egyébként franchise id
  const [onlyDownloaded, setOnlyDownloaded] = useState(false);
  const [sort, setSort] = useState('added_desc');
  const [query, setQuery] = useState(''); // keresés a felvett címek között

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
        refreshSeasons((rows) => {
          if (cancelled) return;
          const byId = new Map(rows.map((r) => [r.id, r]));
          setTitles((ts) => ts.map((t) => byId.get(t.id) ?? t));
        }).catch((err) => console.warn('Évadok frissítése sikertelen:', err.message));

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
          (!franchise ||
            (franchise === NO_FRANCHISE
              ? t.franchise_id == null
              : String(t.franchise_id) === franchise)) &&
          (!onlyDownloaded || t.is_downloaded) &&
          words.every((w) => searchText.get(t.id).includes(w))
      ),
    [ofType, genre, franchise, onlyDownloaded, words, searchText]
  );

  const countByStatus = useMemo(() => {
    const counts = {};
    for (const t of beforeStatus) counts[t.status] = (counts[t.status] ?? 0) + 1;
    return counts;
  }, [beforeStatus]);

  const visible = useMemo(() => {
    const { compare } = SORTS.find((s) => s.code === sort);
    return beforeStatus.filter((t) => status === 'all' || t.status === status).sort(compare);
  }, [beforeStatus, status, sort]);

  // lapozás: ha a szűrés vagy a rendezés változik (más kulcs), automatikusan az 1. oldal
  const filterKey = [type, status, genre, franchise, onlyDownloaded, sort, words.join(' ')].join('|');
  const [pageState, setPageState] = useState({ key: '', page: 1 });
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

  // gépeléskor a filmek és a sorozatok között is keres; a keresés törlésekor (ha nincs
  // kiválasztott franchise) újra Filmek
  function changeQuery(value) {
    const nowSearching = fold(value).trim() !== '';
    setQuery(value);
    if (nowSearching && !searching) {
      setType('all');
    } else if (!nowSearching && searching && type === 'all' && !franchiseChosen) {
      backToMovies();
    }
  }

  async function handleCreateFranchise(name) {
    const created = await createFranchise(name);
    setFranchises((fs) => [...fs, created].sort(byName));
    return created;
  }

  async function handleDeleteFranchise(id) {
    await deleteFranchise(id);
    setFranchises((fs) => fs.filter((f) => f.id !== id));
    // az adatbázis már üresre állította a címeknél, itt csak helyben követjük
    setTitles((ts) => ts.map((t) => (t.franchise_id === id ? { ...t, franchise_id: null } : t)));
    if (franchise === String(id)) changeFranchise('');
  }

  // a nyitott szerkesztő ablak is a friss sort kapja (pl. évadok változása után)
  function replaceTitle(row) {
    setTitles((ts) => ts.map((x) => (x.id === row.id ? row : x)));
    setEditing((e) => (e && e.id === row.id ? row : e));
  }

  // az IMDb-importból beírt csillagok helyben is
  function applyRatingsLocally(changes) {
    const byId = new Map(changes.map((c) => [c.id, c.to]));
    setTitles((ts) => ts.map((t) => (byId.has(t.id) ? { ...t, my_rating: byId.get(t.id) } : t)));
  }

  function removeTitle(id) {
    setTitles((ts) => ts.filter((x) => x.id !== id));
  }

  // a típust (filmek / sorozatok) meghagyja; a "Filmek és sorozatok" csak franchise-szal
  // vagy kereséssel választható, abból Filmek lesz
  function resetFilters() {
    setStatus('all');
    setGenre('');
    setFranchise('');
    setOnlyDownloaded(false);
    setQuery('');
    if (type === 'all') setType('movie');
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
          <span className="muted small">{session.user.email}</span>
          {!loading && !loadError && (
            <ImdbRatingsImport titles={titles} onApplied={applyRatingsLocally} />
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
              {statuses.map((s) => (
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
                {statuses.map((s) => (
                  <Chip
                    key={s.code}
                    active={status === s.code}
                    onClick={() => setStatus(s.code)}
                    label={s.name}
                    count={countByStatus[s.code] ?? 0}
                  />
                ))}
              </div>

              <label className="check">
                <input
                  type="checkbox"
                  checked={onlyDownloaded}
                  onChange={(e) => setOnlyDownloaded(e.target.checked)}
                />
                Letöltöttek
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
              <button type="button" className="link" onClick={resetFilters}>
                {searching ? 'Keresés és szűrők törlése' : 'Szűrők törlése'}
              </button>
            </p>
          ) : isDesktop ? (
            <TitleTable
              titles={paged}
              statuses={statuses}
              franchises={franchises}
              onCreateFranchise={handleCreateFranchise}
              onDeleteFranchise={handleDeleteFranchise}
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
          onSaved={replaceTitle}
          onChanged={replaceTitle}
          onDeleted={removeTitle}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}
