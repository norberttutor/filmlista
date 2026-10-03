'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { addTitle, titleKey } from '@/lib/titles';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w154';
// alapból nyitva; ha becsukja, a böngésző megjegyzi (ha nem tudja, nyitva marad). Telefonon
// (≤ 640 px, mint a CSS-ben) mindig csukva indul – kevés a hely (Norbi kérése); ott a nyitás /
// csukás csak az adott ablakra szól, a megjegyzett beállítást nem írja felül.
const OPEN_KEY = 'filmlista-hasonlok';
const PHONE_QUERY = '(max-width: 640px)';

const isPhone = () => window.matchMedia(PHONE_QUERY).matches;

function storedOpen() {
  if (isPhone()) return false;
  try {
    return localStorage.getItem(OPEN_KEY) !== '0';
  } catch {
    return true;
  }
}

// "Hasonló címek" a szerkesztő ablakban: a TMDB ajánlásai borítóval, vízszintesen görgetve;
// mindegyik egy kattintással felvehető a listára (mint a "Cím hozzáadása" panelen), a már
// listán lévőknél "✓ A listán". Nyitva tölt be; ha becsukja, azt a böngésző megjegyzi
// (telefonon mindig csukva indul).
export default function SimilarTitles({ title, existingKeys, onAdded }) {
  const bodyId = useId();
  const [open, setOpen] = useState(storedOpen);
  const [load, setLoad] = useState({ status: 'idle', results: [], error: '' });
  const [adding, setAdding] = useState(null); // a felvétel alatt álló cím kulcsa
  const [errors, setErrors] = useState({}); // kulcs → hibaüzenet
  const fetched = useRef(false); // betöltve (újranyitáskor nem kéri le újra)

  // kinyitáskor tölt be; ha betöltés közben becsukja, vagy hiba volt, a következő nyitás újrapróbálja
  useEffect(() => {
    if (!open || fetched.current || !title.tmdb_id) return;
    const controller = new AbortController();
    setLoad({ status: 'loading', results: [], error: '' });
    apiGet(
      '/api/tmdb/similar',
      { type: title.media_type, id: title.tmdb_id },
      { signal: controller.signal }
    )
      .then(({ results }) => {
        fetched.current = true;
        setLoad({ status: 'done', results, error: '' });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setLoad({ status: 'error', results: [], error: err.message });
      });
    return () => controller.abort();
  }, [open, title.media_type, title.tmdb_id]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (isPhone()) return;
    try {
      localStorage.setItem(OPEN_KEY, next ? '1' : '0');
    } catch {
      // csak most érvényes
    }
  }

  async function add(r) {
    const key = titleKey(r);
    setAdding(key);
    setErrors((e) => ({ ...e, [key]: '' }));
    try {
      onAdded(await addTitle({ media_type: r.media_type, tmdb_id: r.tmdb_id }));
    } catch (err) {
      setErrors((e) => ({ ...e, [key]: err.message }));
    }
    setAdding(null);
  }

  if (!title.tmdb_id) return null;

  return (
    <section className="similar">
      <button
        type="button"
        className="similar-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
      >
        Hasonló címek
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {open && (
        <div id={bodyId} className="similar-body">
          {/* betöltés közben borító-körvonalak (felolvasónak a szöveg) */}
          {load.status === 'loading' && (
            <>
              <p className="sr-only" role="status">
                Hasonló címek keresése…
              </p>
              <div className="similar-sk" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="sk-card">
                    <span className="sk sk-poster" />
                    <span className="sk sk-line sk-w80" />
                  </span>
                ))}
              </div>
            </>
          )}
          {load.status === 'error' && (
            <p className="error small" role="alert">
              {load.error}
            </p>
          )}
          {load.status === 'done' && load.results.length === 0 && (
            <p className="muted small">A TMDB ehhez a címhez nem ajánl hasonlót.</p>
          )}
          {load.results.length > 0 && (
            <ul className="similar-list" aria-label={`Hasonló címek – ${title.title}`}>
              {load.results.map((r) => {
                const key = titleKey(r);
                const onList = existingKeys.has(key);
                return (
                  <li key={key} className="similar-item">
                    <a
                      className="similar-poster"
                      href={`https://www.themoviedb.org/${r.media_type}/${r.tmdb_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${r.title} adatlapja: TMDB`}
                    >
                      <img src={POSTER_BASE + r.poster_path} alt="" loading="lazy" />
                    </a>
                    <span className="similar-title" title={r.title}>
                      {r.title}
                    </span>
                    <span className="similar-meta">
                      {[r.release_year, r.media_type === 'tv' ? 'Sorozat' : 'Film']
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {onList ? (
                      <span className="on-list">✓ A listán</span>
                    ) : (
                      <button
                        type="button"
                        className="ghost mini"
                        disabled={adding === key}
                        aria-label={`Hozzáadás a listához: ${r.title}`}
                        onClick={() => add(r)}
                      >
                        {adding === key ? 'Hozzáadás…' : '+ Hozzáadás'}
                      </button>
                    )}
                    {errors[key] && <span className="error small">{errors[key]}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
