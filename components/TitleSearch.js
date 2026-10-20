'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { addTitle, titleKey } from '@/lib/titles';
import Discover from '@/components/Discover';

const THUMB_BASE = 'https://image.tmdb.org/t/p/w154';
const FACE_BASE = 'https://image.tmdb.org/t/p/w185';
const MIN_LENGTH = 2;
const DEBOUNCE_MS = 400;
const NOTHING = { q: '', results: [], people: [], peopleFirst: false, error: '' };

// recommendSeeds: a Felfedezés „Neked ajánlott” sorának kiinduló címei (terv-3 37);
// initialQuery: kitöltve nyílik (pl. az üres listakeresés „Keresés a TMDB-n” gombjáról);
// onPreview(találat, borítóElem): a borítóra / címre kattintva a cím adatlapja (előnézet, a
// listán lévőé szerkeszthető) – a találatoknál és a Felfedezésben is;
// onPerson(személy): a talált színész / rendező lapja (terv-3 110; { id, name, profile_path, role })
export default function TitleSearch({ existingKeys, recommendSeeds, onAdded, onPreview, onPerson, onClose, initialQuery = '' }) {
  const [query, setQuery] = useState(initialQuery);
  // az utolsó befejezett keresés: melyik szövegre, mit kaptunk
  const [found, setFound] = useState(NOTHING);
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
        // (a people a terv-3 110 óta van: a böngészőben tárolt régebbi válaszban hiányozhat)
        .then((data) => setFound({ ...NOTHING, q, results: data.results, people: data.people ?? [], peopleFirst: !!data.peopleFirst }))
        .catch((err) => {
          if (err.name !== 'AbortError') setFound({ ...NOTHING, q, error: err.message });
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort(); // a régi szövegre induló keresés eredménye már nem kell
    };
  }, [q]);

  // watched: „Már láttam” (terv-3 80) – megnézettként kerül fel, a Watchlist rögtön megkérdezi, hogy tetszett
  async function handleAdd(result, watched = false) {
    const key = titleKey(result);
    setRowState((s) => ({ ...s, [key]: { busy: watched ? 'watched' : 'add' } }));
    try {
      onAdded(await addTitle(result, null, { watched }));
      setRowState((s) => ({ ...s, [key]: {} }));
    } catch (err) {
      setRowState((s) => ({ ...s, [key]: { error: err.message } }));
    }
  }

  let status = '';
  if (q.length > 0 && q.length < MIN_LENGTH) status = `Írj be legalább ${MIN_LENGTH} karaktert.`;
  else if (searching) status = 'Keresés…';
  else if (q.length >= MIN_LENGTH && !found.error) {
    const n = found.results.length;
    const m = found.people.length;
    status =
      n + m > 0
        ? [n > 0 && `${n} találat`, m > 0 && `${m} személy`].filter(Boolean).join(' · ')
        : `Nincs találat erre: „${q}”. Próbáld az eredeti címmel is.`;
  }

  // a talált színészek és rendezők (terv-3 110): kattintásra a lapjuk – ha a TMDB őket tette az első
  // helyre (névre kerestél), a címek előtt, különben utánuk
  const peopleList = q.length >= MIN_LENGTH && found.people.length > 0 && (
    <section className="people-results" aria-label="Színészek és rendezők">
      <h3 className="people-results-title">Színészek és rendezők</h3>
      <ul>
        {found.people.map((p) => (
          <li key={p.person_id}>
            <button
              type="button"
              className="people-result"
              onClick={() => onPerson({ id: p.person_id, name: p.name, profile_path: p.profile_path, role: p.role })}
            >
              <span className="people-result-photo" aria-hidden="true">
                {p.profile_path && <img src={FACE_BASE + p.profile_path} alt="" loading="lazy" />}
              </span>
              <span className="people-result-text">
                <span className="people-result-name">{p.name}</span>
                <span className="people-result-meta">
                  {p.role === 'director' ? 'Rendező' : 'Színész'}
                  {p.known_for.length > 0 && ` · ${p.known_for.join(', ')}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <section id="add-panel" className="add-panel" aria-label="Cím hozzáadása">
      <form className="search-row" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="search-field">
          {/* (a „Film vagy sorozat címe” eleje a tesztek kapaszkodója) */}
          Film vagy sorozat címe – vagy színész, rendező
          <input
            type="search"
            autoFocus
            autoComplete="off"
            placeholder="pl. Dűne vagy Tom Hanks"
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

      {found.peopleFirst && peopleList}

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
                    <div className="result-actions">
                      <button
                        type="button"
                        className="primary"
                        aria-describedby={titleId}
                        disabled={Boolean(state.busy)}
                        onClick={() => handleAdd(r)}
                      >
                        {state.busy === 'add' ? 'Hozzáadás…' : 'Hozzáadás a listához'}
                      </button>
                      {/* már látott cím: megnézettként kerül fel (terv-3 80) */}
                      <button
                        type="button"
                        className="ghost"
                        aria-describedby={titleId}
                        disabled={Boolean(state.busy)}
                        onClick={() => handleAdd(r, true)}
                      >
                        {state.busy === 'watched' ? 'Hozzáadás…' : 'Már láttam'}
                      </button>
                    </div>
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

      {!found.peopleFirst && peopleList}
    </section>
  );
}
