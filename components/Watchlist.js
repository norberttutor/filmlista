'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import PosterCard from '@/components/PosterCard';
import TitleSearch from '@/components/TitleSearch';
import TitleEditor from '@/components/TitleEditor';
import TitleTable from '@/components/TitleTable';
import { titleKey, createFranchise, deleteFranchise, refreshImdbRatings } from '@/lib/titles';
import { useMediaQuery } from '@/lib/useMediaQuery';

const byName = (a, b) => a.name.localeCompare(b.name, 'hu');

// franchise-szűrő: '' = összes, NO_FRANCHISE = franchise nélküliek, egyébként franchise id
const NO_FRANCHISE = 'none';

// ennél szélesebb képernyőn soros (táblázatos) nézet, alatta borítófal
const DESKTOP_QUERY = '(min-width: 1400px)';

const TYPES = [
  { code: 'movie', name: 'Filmek' },
  { code: 'tv', name: 'Sorozatok' },
];

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [titlesRes, statusesRes, franchisesRes] = await Promise.all([
        supabase
          .from('titles_with_genres')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('statuses').select('*').order('sort_order'),
        supabase.from('franchises').select('id, name'),
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
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // a kiválasztott típus (filmek / sorozatok) címei
  const ofType = useMemo(() => titles.filter((t) => t.media_type === type), [titles, type]);

  // csak azok a műfajok, amelyek ennél a típusnál ténylegesen előfordulnak
  const genres = useMemo(
    () =>
      [...new Set(ofType.flatMap((t) => t.genres ?? []))].sort((a, b) =>
        a.localeCompare(b, 'hu')
      ),
    [ofType]
  );

  // a szűrőben csak az ennél a típusnál ténylegesen használt franchise-ok
  const usedFranchises = useMemo(() => {
    const used = new Set(ofType.map((t) => t.franchise_id));
    return franchises.filter((f) => used.has(f.id));
  }, [ofType, franchises]);

  const franchiseName = useMemo(
    () => new Map(franchises.map((f) => [f.id, f.name])),
    [franchises]
  );

  // a keresőben ezek alapján látszik, mi van már a listán
  const existingKeys = useMemo(() => new Set(titles.map(titleKey)), [titles]);

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
          (!onlyDownloaded || t.is_downloaded)
      ),
    [ofType, genre, franchise, onlyDownloaded]
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

  function changeType(code) {
    setType(code);
    setGenre(''); // a filmek és sorozatok műfajai eltérnek
    // a franchise-szűrő marad, ha az új típusnál is van ilyen cím (pl. Star Wars film és sorozat)
    if (
      franchise !== NO_FRANCHISE &&
      !titles.some((t) => t.media_type === code && String(t.franchise_id) === franchise)
    ) {
      setFranchise('');
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
    if (franchise === String(id)) setFranchise('');
  }

  function replaceTitle(row) {
    setTitles((ts) => ts.map((x) => (x.id === row.id ? row : x)));
  }

  function removeTitle(id) {
    setTitles((ts) => ts.filter((x) => x.id !== id));
  }

  // a típust (filmek / sorozatok) meghagyja
  function resetFilters() {
    setStatus('all');
    setGenre('');
    setFranchise('');
    setOnlyDownloaded(false);
  }

  return (
    <main>
      <header className="top">
        <div>
          <h1 className="brand">Megnézendő filmek</h1>
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

          <section className="filters" aria-label="Szűrők">
            <select
              className="type-select"
              aria-label="Típus"
              value={type}
              onChange={(e) => changeType(e.target.value)}
            >
              {TYPES.map((t) => (
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
              <label className="inline-field">
                Franchise
                <select value={franchise} onChange={(e) => setFranchise(e.target.value)}>
                  <option value="">Összes</option>
                  <option value={NO_FRANCHISE}>Franchise nélkül</option>
                  {usedFranchises.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="inline-field sort-field">
              Rendezés
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORTS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
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
              Nincs a szűrésnek megfelelő cím.{' '}
              <button type="button" className="link" onClick={resetFilters}>
                Szűrők törlése
              </button>
            </p>
          ) : isDesktop ? (
            <TitleTable
              titles={visible}
              statuses={statuses}
              franchises={franchises}
              onCreateFranchise={handleCreateFranchise}
              onDeleteFranchise={handleDeleteFranchise}
              onUpdated={replaceTitle}
              onDeleted={removeTitle}
            />
          ) : (
            <ul className="grid">
              {visible.map((t) => (
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
          onDeleted={removeTitle}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}
