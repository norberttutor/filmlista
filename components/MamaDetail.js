'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { useBackdropClose } from '@/lib/useBackdropClose';
import { useSheetDrag } from '@/lib/useSheetDrag';
import { usePosterColor, ambientProps } from '@/lib/posterColor';
import ImdbBadge from '@/components/ImdbBadge';
import { formatRuntime } from '@/lib/titles';
import WatchProviders from '@/components/WatchProviders';
import { TrailerButton, TrailerPlayer } from '@/components/Trailer';

const IMG = 'https://image.tmdb.org/t/p/';

// Mama adatlapja (terv-3 13): háttérkép, borító, cím, év, műfajok, IMDb-érték, előzetes, leírás,
// „Hol nézhető?” – szerkesztő mezők nélkül –, alul „Érdekel” / „Nem érdekel”. A borító színében
// dereng (terv-3 52.4). Asztalon ablak
// (kikattintásra bezárul – nincs benne bevitel), telefonon alulról felcsúszó lap (a fogantyút
// lefelé húzva bezárul, mint Norbi adatlapja). A „Nem érdekel” a listából is kiveszi (a hívó zárja).
export default function MamaDetail({ item: t, onMark, onClose }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const backdrop = useBackdropClose(dialogRef, { onClose: () => dialogRef.current.close() });
  // telefonon: a fogantyút lefelé húzva bezárul
  const sheetDrag = useSheetDrag(dialogRef, () => dialogRef.current?.close());
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

  const yes = t.mama_status === 'interested';
  const genres = (t.genres ?? []).join(' · ');
  // az adatlap a borító színében dereng, mint Norbié (terv-3 52.4, „A” változat)
  const ambient = usePosterColor(t.poster_path);

  return (
    <dialog ref={dialogRef} className="editor mama-detail" aria-labelledby="mama-detail-title" onClose={onClose} {...backdrop} {...ambientProps(ambient)}>
      <div className="sheet-handle" aria-hidden="true" {...sheetDrag} />
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
            {/* a játékidő is (terv-3 129); a mama_list() filmet ad, a media_type nincs benne */}
            {[t.release_year, genres, formatRuntime({ ...t, media_type: 'movie' })?.text].filter(Boolean).join(' · ')}
            <ImdbBadge title={t} />
          </p>
          <TrailerButton trailer={trailer} playing={playing} onToggle={() => setPlaying((p) => !p)} />
          <TrailerPlayer trailer={trailer} playing={playing} title={t.title} />
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
