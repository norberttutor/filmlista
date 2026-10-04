'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { addTitle, updateTitle } from '@/lib/titles';

const IMG = 'https://image.tmdb.org/t/p/';

// Franchise-ra szűrve a lista fölött sáv: a franchise TMDB-gyűjteménye (a filmjei alapján,
// /api/tmdb/collection), hány részét láttad / van a listán; a „Gyűjtemény” ablakban az összes
// rész megjelenési sorrendben, a hiányzók egy kattintással felvehetők (a franchise is beállítódik).
// Ha a franchise filmjei nem tartoznak TMDB-gyűjteménybe, nem jelenik meg semmi.
export default function FranchiseCollection({ franchise, titles, onAdded }) {
  const movies = titles.filter((t) => t.franchise_id === franchise.id && t.media_type === 'movie');
  const ids = movies.map((t) => t.tmdb_id).sort((a, b) => a - b).join(',');
  const [collection, setCollection] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!ids) return;
    const controller = new AbortController();
    apiGet('/api/tmdb/collection', { movies: ids }, { signal: controller.signal })
      .then((data) => setCollection(data.collection))
      .catch((err) => err.name !== 'AbortError' && console.warn('Gyűjtemény:', err.message));
    return () => controller.abort();
  }, [ids]);

  if (!collection || !ids) return null;

  // a részek a listán: tmdb_id → cím (bármelyik franchise-ban)
  const byTmdb = new Map(titles.filter((t) => t.media_type === 'movie').map((t) => [t.tmdb_id, t]));
  const parts = collection.parts.map((p) => ({ ...p, own: byTmdb.get(p.tmdb_id) ?? null }));
  const total = parts.length;
  const watched = parts.filter((p) => p.own?.status === 'watched').length;
  const onList = parts.filter((p) => p.own).length;

  return (
    <>
      <div className="collection-banner">
        {franchise.logo_path ? (
          // a w185-ös képeket a hangulatszín és a logó-világosság vászonra rajzolja: csak CORS-szal
          // (különben a gyorsítótárból engedély nélküli választ kapnának – CLAUDE.md, posterColor)
          <img className="collection-logo" src={`${IMG}w185${franchise.logo_path}`} alt={franchise.name} crossOrigin="anonymous" />
        ) : (
          <b>{franchise.name}</b>
        )}
        <Meter total={total} watched={watched} onList={onList} />
        <span className="collection-count">
          <b>
            {watched}/{total}
          </b>{' '}
          megnézve · {onList} a listán{onList < total && ` · ${total - onList} hiányzik`}
        </span>
        <button type="button" className="ghost" onClick={() => setOpen(true)}>
          Gyűjtemény
        </button>
      </div>
      {open && (
        <CollectionDialog
          franchise={franchise}
          collection={collection}
          parts={parts}
          counts={{ total, watched, onList }}
          onAdded={onAdded}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function Meter({ total, watched, onList }) {
  return (
    <span className="collection-meter" aria-hidden="true">
      <i style={{ width: `${(watched / total) * 100}%` }} />
      <i className="on-list" style={{ width: `${((onList - watched) / total) * 100}%` }} />
    </span>
  );
}

function CollectionDialog({ franchise, collection, parts, counts, onAdded, onClose }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const [state, setState] = useState({}); // tmdb_id → { busy } | { error }
  const missing = parts.filter((p) => !p.own);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
  }, []);

  async function add(p) {
    setState((s) => ({ ...s, [p.tmdb_id]: { busy: true } }));
    try {
      const row = await addTitle(p);
      onAdded(await updateTitle(row.id, { franchise_id: franchise.id }));
      setState((s) => ({ ...s, [p.tmdb_id]: {} }));
    } catch (err) {
      setState((s) => ({ ...s, [p.tmdb_id]: { error: err.message } }));
    }
  }

  // a hiányzók kettesével (mint a tömeges import)
  async function addMissing() {
    for (let i = 0; i < missing.length; i += 2) {
      await Promise.all(missing.slice(i, i + 2).map(add));
    }
  }

  const busyAny = Object.values(state).some((s) => s.busy);

  return (
    <dialog
      ref={dialogRef}
      className="editor collection-dialog"
      aria-labelledby="collection-title"
      onClose={onClose}
    >
      <div
        className="collection-head"
        style={collection.backdrop_path ? { backgroundImage: `url(${IMG}w1280${collection.backdrop_path})` } : undefined}
      >
        <h2 id="collection-title" ref={headingRef} tabIndex={-1}>
          {franchise.name}
        </h2>
        <p className="collection-sub">
          A teljes gyűjtemény a TMDB-ről, megjelenési sorrendben · {counts.total} film
        </p>
        <p className="collection-prog">
          <Meter {...counts} />
          <span>
            <b>
              {counts.watched}/{counts.total}
            </b>{' '}
            megnézve · {counts.onList} a listán
            {missing.length > 0 && ` · ${missing.length} hiányzik`}
          </span>
        </p>
      </div>
      <ol className="collection-parts">
        {parts.map((p) => {
          const s = state[p.tmdb_id] ?? {};
          const status = p.own ? p.own.status : 'missing';
          return (
            <li key={p.tmdb_id} data-state={status}>
              <div className="collection-poster">
                {p.poster_path ? (
                  <img src={`${IMG}w185${p.poster_path}`} alt="" loading="lazy" crossOrigin="anonymous" />
                ) : (
                  <span className="poster-fallback" />
                )}
                {p.own?.is_downloaded && <span className="badge">Letöltve</span>}
              </div>
              <b>{p.title}</b>
              <span className="muted small">{p.release_year ?? 'Bejelentve'}</span>
              {!p.own ? (
                <button type="button" className="ghost" disabled={s.busy} onClick={() => add(p)}>
                  {s.busy ? 'Hozzáadás…' : '+ Hozzáadás'}
                </button>
              ) : status === 'watched' ? (
                <span className="collection-state watched">
                  ✓ Megnézve{p.own.my_rating && <span className="mine"> · {p.own.my_rating}/10</span>}
                </span>
              ) : (
                <span className="collection-state">A listán</span>
              )}
              {s.error && (
                <p className="error small" role="alert">
                  {s.error}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <div className="editor-actions">
        {missing.length > 1 && (
          <button type="button" className="ghost" disabled={busyAny} onClick={addMissing}>
            A hiányzó {missing.length} felvétele
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="primary" onClick={() => dialogRef.current.close()}>
          Bezárás
        </button>
      </div>
    </dialog>
  );
}
