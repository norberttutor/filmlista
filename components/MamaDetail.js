'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { useBackdropClose } from '@/lib/useBackdropClose';
import ImdbBadge from '@/components/ImdbBadge';
import WatchProviders from '@/components/WatchProviders';

const IMG = 'https://image.tmdb.org/t/p/';
const PHONE_QUERY = '(max-width: 640px)';

// Mama adatlapja (terv-3 13): háttérkép, borító, cím, év, műfajok, IMDb-érték, előzetes, leírás,
// „Hol nézhető?” – szerkesztő mezők nélkül –, alul „Érdekel” / „Nem érdekel”. Asztalon ablak
// (kikattintásra bezárul – nincs benne bevitel), telefonon alulról felcsúszó lap (a fogantyút
// lefelé húzva bezárul, mint Norbi adatlapja). A „Nem érdekel” a listából is kiveszi (a hívó zárja).
export default function MamaDetail({ item: t, onMark, onClose }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const drag = useRef(null);
  const backdrop = useBackdropClose(dialogRef, { onClose: () => dialogRef.current.close() });
  const [trailer, setTrailer] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [providers, setProviders] = useState(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
  }, []);

  // előzetes és „Hol nézhető?” a háttérben (ha nincs vagy nem sikerül, nem jelenik meg)
  useEffect(() => {
    const controller = new AbortController();
    const opts = { signal: controller.signal };
    apiGet('/api/tmdb/videos', { type: 'movie', id: t.tmdb_id }, opts)
      .then((d) => setTrailer(d.video))
      .catch((err) => err.name !== 'AbortError' && console.warn('Előzetes:', err.message));
    apiGet('/api/tmdb/providers', { type: 'movie', id: t.tmdb_id }, opts)
      .then((d) => setProviders(d.providers))
      .catch((err) => err.name !== 'AbortError' && console.warn('Hol nézhető:', err.message));
    return () => controller.abort();
  }, [t.tmdb_id]);

  // telefonon: a fogantyút lefelé húzva bezárul (elég messzire vagy gyorsan), különben visszaugrik
  function dragStart(e) {
    if (!window.matchMedia(PHONE_QUERY).matches) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    dialogRef.current.style.transition = 'none';
  }
  function dragMove(e) {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    dialogRef.current.style.translate = `0 ${drag.current.dy}px`;
  }
  function dragEnd() {
    if (!drag.current) return;
    const { dy, t: start } = drag.current;
    drag.current = null;
    const dialog = dialogRef.current;
    dialog.style.transition = '';
    if (dy > 110 || (dy / (performance.now() - start) > 0.6 && dy > 30)) {
      dialog.style.translate = '0 100%';
      setTimeout(() => dialog.close(), 180);
    } else {
      dialog.style.translate = '';
    }
  }

  const yes = t.mama_status === 'interested';
  const genres = (t.genres ?? []).join(' · ');

  return (
    <dialog ref={dialogRef} className="editor mama-detail" aria-labelledby="mama-detail-title" onClose={onClose} {...backdrop}>
      <div
        className="sheet-handle"
        aria-hidden="true"
        onPointerDown={dragStart}
        onPointerMove={dragMove}
        onPointerUp={dragEnd}
        onPointerCancel={dragEnd}
      />
      <button type="button" className="icon-btn mama-close" aria-label="Bezárás" onClick={() => dialogRef.current.close()}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </button>
      {t.backdrop_path && <div className="mama-backdrop" style={{ backgroundImage: `url(${IMG}w1280${t.backdrop_path})` }} />}
      <div className={t.backdrop_path ? 'mama-detail-body has-backdrop' : 'mama-detail-body'}>
        <span className="mama-detail-poster">{t.poster_path && <img src={`${IMG}w500${t.poster_path}`} alt="" />}</span>
        <div>
          <h2 id="mama-detail-title" ref={headingRef} tabIndex={-1}>
            {t.title}
          </h2>
          <p className="mama-meta">
            {[t.release_year, genres].filter(Boolean).join(' · ')}
            <ImdbBadge title={t} />
          </p>
          {trailer && (
            <button type="button" className="ghost trailer-btn" aria-expanded={playing} onClick={() => setPlaying((p) => !p)}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                <path d={playing ? 'M6 6l12 12M18 6 6 18' : 'M8 5v14l11-7z'} fill={playing ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={playing ? 2.4 : 0} strokeLinecap="round" />
              </svg>
              {playing ? 'Előzetes bezárása' : 'Előzetes megnézése'}
              {!playing && trailer.lang !== 'hu' && <span className="trailer-lang">angolul</span>}
            </button>
          )}
          {playing && trailer && (
            <div className="trailer">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0&hl=hu&cc_lang_pref=hu`}
                title={`Előzetes: ${t.title}`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
          )}
          {t.overview && <p className="mama-detail-overview">{t.overview}</p>}
          <WatchProviders providers={providers} />
        </div>
      </div>
      <div className="mama-detail-actions">
        <button type="button" className="mama-btn yes" aria-pressed={yes} onClick={() => onMark(t, yes ? null : 'interested')}>
          {yes ? '✓ Érdekel' : 'Érdekel'}
        </button>
        <button type="button" className="mama-btn" onClick={() => onMark(t, 'declined')}>
          Nem érdekel
        </button>
      </div>
    </dialog>
  );
}
