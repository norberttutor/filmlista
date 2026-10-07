'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { addTitle, titleKey } from '@/lib/titles';
import Discover from '@/components/Discover';

const THUMB_BASE = 'https://image.tmdb.org/t/p/w154';
const MIN_LENGTH = 2;
const DEBOUNCE_MS = 400;

// recommendSeeds: a Felfedezés „Neked ajánlott” sorának kiinduló címei (terv-3 37);
// initialQuery: kitöltve nyílik (pl. az üres listakeresés „Keresés a TMDB-n” gombjáról);
// onPreview(találat, borítóElem): a borítóra / címre kattintva a cím adatlapja (előnézet, a
// listán lévőé szerkeszthető) – a találatoknál és a Felfedezésben is
export default function TitleSearch({ existingKeys, recommendSeeds, onAdded, onPreview, onClose, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);
  // az utolsó befejezett keresés: melyik szövegre, mit kaptunk
  const [found, setFound] = useState({ q: '', results: [], error: '' });
  // találatonként: { busy } mentés közben, { error } ha nem sikerült
  const [rowState, setRowState] = useState({});

  const q = query.trim();
  const searching = q.length >= MIN_LENGTH && found.q !== q;

  // gépelés közben nem keresünk minden betűnél, csak ha 400 ms-ig nem változik a szöveg
  useEffect(() => {
    if (q.length < MIN_LENGTH) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiGet('/api/tmdb/search', { q }, { signal: controller.signal })
        .then((data) => setFound({ q, results: data.results, error: '' }))
        .catch((err) => {
          if (err.name !== 'AbortError') setFound({ q, results: [], error: err.message });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort(); // a régi szövegre induló keresés eredménye már nem kell
    };
  }, [q]);

  async function handleAdd(result) {
    const key = titleKey(result);
    setRowState((s) => ({ ...s, [key]: { busy: true } }));
    try {
      onAdded(await addTitle(result));
      setRowState((s) => ({ ...s, [key]: {} }));
    } catch (err) {
      setRowState((s) => ({ ...s, [key]: { error: err.message } }));
    }
  }

  let status = '';
  if (q.length > 0 && q.length < MIN_LENGTH) status = `Írj be legalább ${MIN_LENGTH} karaktert.`;
  else if (searching) status = 'Keresés…';
  else if (q.length >= MIN_LENGTH && !found.error) {
    status =
      found.results.length > 0
        ? `${found.results.length} találat`
        : `Nincs találat erre: „${q}”. Próbáld az eredeti címmel is.`;
  }

  return (
    <section id="add-panel" className="add-panel" aria-label="Cím hozzáadása">
      <form className="search-row" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="search-field">
          Film vagy sorozat címe
          <input
            type="search"
            autoFocus
            autoComplete="off"
            placeholder="pl. Dűne"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button type="button" className="ghost" onClick={onClose}>
          Bezárás
        </button>
      </form>

      <p className="search-status" aria-live="polite">
        {status}
      </p>
      {q.length >= MIN_LENGTH && !searching && found.error && (
        <p className="error" role="alert">
          {found.error}
        </p>
      )}

      {/* amíg nincs keresés: felfedező sorok (mozi, hamarosan, digitálisan új, sorozatok) */}
      {q.length === 0 && (
        <Discover existingKeys={existingKeys} seeds={recommendSeeds} rowState={rowState} onAdd={handleAdd} onPreview={onPreview} />
      )}

      {q.length >= MIN_LENGTH && found.results.length > 0 && (
        <ul className="results">
          {found.results.map((r) => {
            const key = titleKey(r);
            const state = rowState[key] ?? {};
            const titleId = `result-${r.media_type}-${r.tmdb_id}`;
            return (
              <li key={key} className="result">
                {/* a borító egérrel kattintható; billentyűzettel / felolvasóval a cím gombja */}
                <button
                  type="button"
                  className="thumb thumb-btn"
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={(e) => onPreview(r, e.currentTarget)}
                >
                  {r.poster_path && <img src={THUMB_BASE + r.poster_path} alt="" loading="lazy" />}
                </button>
                <div className="result-text">
                  <p className="result-title" id={titleId}>
                    <button
                      type="button"
                      className="title-btn"
                      onClick={(e) => onPreview(r, e.currentTarget.closest('.result').querySelector('.thumb'))}
                    >
                      {r.title}
                    </button>
                  </p>
                  {r.original_title && r.original_title !== r.title && (
                    <p className="original">{r.original_title}</p>
                  )}
                  <p className="meta">
                    {r.release_year && <span>{r.release_year}</span>}
                    <span>{r.media_type === 'tv' ? 'Sorozat' : 'Film'}</span>
                  </p>

                  {existingKeys.has(key) ? (
                    <p className="on-list">✓ A listán</p>
                  ) : (
                    <button
                      type="button"
                      className="primary"
                      aria-describedby={titleId}
                      disabled={state.busy}
                      onClick={() => handleAdd(r)}
                    >
                      {state.busy ? 'Hozzáadás…' : 'Hozzáadás a listához'}
                    </button>
                  )}
                  {state.error && (
                    <p className="error small" role="alert">
                      {state.error}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
