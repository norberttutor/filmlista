'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { titleKey } from '@/lib/titles';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w185';

// a „Cím hozzáadása” panel felfedező sorai (üres keresőnél); /api/tmdb/discover
const SECTIONS = [
  { list: 'cinema', title: 'Most a mozikban', sub: 'Az utóbbi hónapok magyarországi bemutatói, népszerűség szerint' },
  { list: 'upcoming', title: 'Hamarosan a mozikban', sub: 'A következő három hónap magyarországi bemutatói' },
  { list: 'digital', title: 'Új digitálisan', sub: 'Az utóbbi hetekben lett letölthető, streamelhető' },
  { list: 'tv', title: 'Népszerű sorozatok', sub: 'Magyar streamingen elérhető, most futó sorozatok' },
];

const shortDate = (iso) => new Date(iso).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });

// existingKeys: a listán lévők; rowState / onAdd: a kereső panel felvétele (ugyanaz, mint a
// találatoknál); onPreview(cím, borítóElem): a borítóra kattintva a cím adatlapja (előnézet)
export default function Discover({ existingKeys, rowState, onAdd, onPreview }) {
  const [lists, setLists] = useState({}); // list → { results } | { error }

  useEffect(() => {
    const controller = new AbortController();
    for (const s of SECTIONS) {
      apiGet('/api/tmdb/discover', { list: s.list }, { signal: controller.signal })
        .then((data) => setLists((l) => ({ ...l, [s.list]: { results: data.results } })))
        .catch((err) => {
          if (err.name !== 'AbortError') setLists((l) => ({ ...l, [s.list]: { error: err.message } }));
        });
    }
    return () => controller.abort();
  }, []);

  return (
    <div className="discover">
      <p className="muted small">
        Csak Magyarországon megjelent, angol vagy magyar nyelvű címek – ezek többnyire szinkronosak.
      </p>
      {SECTIONS.map((s) => {
        const data = lists[s.list];
        if (data?.results?.length === 0) return null;
        return (
          <section key={s.list} className="discover-row" aria-labelledby={`discover-${s.list}`}>
            <h3 id={`discover-${s.list}`}>{s.title}</h3>
            <p className="discover-sub">{s.sub}</p>
            {data?.error ? (
              <p className="error small" role="alert">
                {data.error}
              </p>
            ) : !data ? (
              <div className="discover-list" aria-busy="true" aria-label={`${s.title} betöltése…`}>
                {Array.from({ length: 8 }, (_, i) => (
                  <span key={i} className="sk discover-sk" />
                ))}
              </div>
            ) : (
              <ul className="discover-list">
                {data.results.map((r) => {
                  const key = titleKey(r);
                  const id = `discover-${r.media_type}-${r.tmdb_id}`;
                  const state = rowState[key] ?? {};
                  return (
                    <li key={key} className="discover-item">
                      <button
                        type="button"
                        className="discover-poster"
                        aria-label={`${r.title} adatlapja`}
                        onClick={(e) => onPreview(r, e.currentTarget)}
                      >
                        {/* CORS-szal (a vászonra rajzolhatóság miatt; a hangulatszín ma már külön, kisebb képből számol) */}
                        <img src={POSTER_BASE + r.poster_path} alt="" loading="lazy" crossOrigin="anonymous" />
                      </button>
                      <b className="discover-title" id={id}>
                        {r.title}
                      </b>
                      <span className="muted small">
                        {s.list === 'upcoming' && r.release_date ? shortDate(r.release_date) : r.release_year}
                        {' · '}
                        {r.media_type === 'tv' ? 'Sorozat' : 'Film'}
                      </span>
                      {existingKeys.has(key) ? (
                        <span className="on-list">✓ A listán</span>
                      ) : (
                        <button
                          type="button"
                          className="ghost"
                          aria-describedby={id}
                          disabled={state.busy}
                          onClick={() => onAdd(r)}
                        >
                          {state.busy ? 'Hozzáadás…' : '+ Hozzáadás'}
                        </button>
                      )}
                      {state.error && (
                        <p className="error small" role="alert">
                          {state.error}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
