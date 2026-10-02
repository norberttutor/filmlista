'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import PosterCard from '@/components/PosterCard';
import TitleSearch from '@/components/TitleSearch';
import TitleEditor from '@/components/TitleEditor';
import TitleTable from '@/components/TitleTable';
import { titleKey } from '@/lib/titles';
import { useMediaQuery } from '@/lib/useMediaQuery';

// ennél szélesebb képernyőn soros (táblázatos) nézet, alatta borítófal
const DESKTOP_QUERY = '(min-width: 960px)';

const TYPES = [
  { code: 'all', name: 'Mind' },
  { code: 'movie', name: 'Filmek' },
  { code: 'tv', name: 'Sorozatok' },
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null); // a szerkesztett cím, vagy null
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  // szűrők
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [genre, setGenre] = useState('');
  const [onlyDownloaded, setOnlyDownloaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [titlesRes, statusesRes] = await Promise.all([
        supabase
          .from('titles_with_genres')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('statuses').select('*').order('sort_order'),
      ]);
      if (cancelled) return;

      if (titlesRes.error || statusesRes.error) {
        console.error(titlesRes.error || statusesRes.error);
        setLoadError(
          'Nem sikerült betölteni a listát. Ellenőrizd a .env.local beállításait, és hogy fut-e a Supabase projekt.'
        );
      } else {
        setTitles(titlesRes.data);
        setStatuses(statusesRes.data);
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // csak azok a műfajok, amelyek ténylegesen előfordulnak a listán
  const genres = useMemo(
    () =>
      [...new Set(titles.flatMap((t) => t.genres ?? []))].sort((a, b) =>
        a.localeCompare(b, 'hu')
      ),
    [titles]
  );

  // a keresőben ezek alapján látszik, mi van már a listán
  const existingKeys = useMemo(() => new Set(titles.map(titleKey)), [titles]);

  const countByStatus = useMemo(() => {
    const counts = {};
    for (const t of titles) counts[t.status] = (counts[t.status] ?? 0) + 1;
    return counts;
  }, [titles]);

  const visible = useMemo(
    () =>
      titles.filter(
        (t) =>
          (status === 'all' || t.status === status) &&
          (type === 'all' || t.media_type === type) &&
          (!genre || (t.genres ?? []).includes(genre)) &&
          (!onlyDownloaded || t.is_downloaded)
      ),
    [titles, status, type, genre, onlyDownloaded]
  );

  function replaceTitle(row) {
    setTitles((ts) => ts.map((x) => (x.id === row.id ? row : x)));
  }

  function removeTitle(id) {
    setTitles((ts) => ts.filter((x) => x.id !== id));
  }

  function resetFilters() {
    setStatus('all');
    setType('all');
    setGenre('');
    setOnlyDownloaded(false);
  }

  return (
    <main>
      <header className="top">
        <div>
          <h1 className="brand">Filmlista</h1>
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
            <div className="chips" role="group" aria-label="Állapot">
              <Chip
                active={status === 'all'}
                onClick={() => setStatus('all')}
                label="Mind"
                count={titles.length}
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

            <div className="chips" role="group" aria-label="Típus">
              {TYPES.map((t) => (
                <Chip
                  key={t.code}
                  active={type === t.code}
                  onClick={() => setType(t.code)}
                  label={t.name}
                />
              ))}
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

            <label className="check">
              <input
                type="checkbox"
                checked={onlyDownloaded}
                onChange={(e) => setOnlyDownloaded(e.target.checked)}
              />
              Csak a letöltöttek
            </label>
          </section>

          {titles.length === 0 ? (
            <p className="state">
              A listád még üres. Keress rá egy filmre vagy sorozatra a „Cím hozzáadása”
              gombbal.
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
              onUpdated={replaceTitle}
              onDeleted={removeTitle}
            />
          ) : (
            <ul className="grid">
              {visible.map((t) => (
                <li key={t.id}>
                  <PosterCard title={t} onEdit={setEditing} />
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
          onSaved={replaceTitle}
          onDeleted={removeTitle}
          onClose={() => setEditing(null)}
        />
      )}
    </main>
  );
}
