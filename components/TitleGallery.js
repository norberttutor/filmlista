'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useBackLayer } from '@/lib/backClose';

// Képgaléria az adatlapon (terv-3 95, 2026-10-14, Norbi választása a látványterv után: asztalon „A” – „Képek”
// sor, telefonon „B” – lapozható jelenetkép; https://claude.ai/artifact/BDEffdLNcJoJ4h3gtjsGWC). A képek a
// /api/tmdb/images route-ból (a TitleEditor kéri le); az első a lap saját jelenetképe. Rákattintva nagy nézet
// (GalleryLightbox): ‹ › / nyilak / ujjal húzva lapoz, alul a kis képek, „× Bezárás”; az Esc, a Vissza gomb és a
// telefonos vissza-gesztus is bezárja (lib/backClose.js – useBackLayer). Mindkét témában sötét (sötét sziget).

export const IMG = 'https://image.tmdb.org/t/p/';
const SWIPE_PX = 40;

// a lap jelenetképe elöl, utána a TMDB többi képe (ismétlés nélkül), legfeljebb 8
export function galleryList(backdrop, images) {
  const list = [backdrop, ...(images ?? []).filter((p) => p !== backdrop)].filter(Boolean);
  return list.slice(0, 8);
}

// vízszintes húzás → lépés (-1 / +1); a függőleges görgetés megmarad (touch-action: pan-y a CSS-ben)
function useSwipe(onStep) {
  const start = useRef(null);
  return {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse') return;
      start.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - s.y)) onStep(dx < 0 ? 1 : -1);
    },
    onPointerCancel: () => (start.current = null),
  };
}

export const Chevron = ({ left }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d={left ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// A – asztalon: „Képek N” szakasz, vízszintesen görgethető kis képek
export function GalleryStrip({ images, onOpen }) {
  return (
    <section className="gallery" aria-labelledby="gallery-title">
      <div className="gallery-head">
        <h3 className="gallery-title" id="gallery-title">
          Képek
        </h3>
        <span className="gallery-count">{images.length}</span>
      </div>
      <ul className="gallery-strip">
        {images.map((p, i) => (
          <li key={p}>
            <button type="button" aria-label={`${i + 1}. kép nagyban`} onClick={() => onOpen(i)}>
              <img src={IMG + 'w300' + p} alt="" loading="lazy" decoding="async" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

// B – telefonon: a jelenetkép lapozója (jobbra fent „‹ 1 / 8 ›”, alul pöttyök; ujjal húzva is); a képre
// koppintva nagy nézet. A kép maga a TitlePage-é (az editor-backdrop), ez csak a vezérlő.
export function BackdropPager({ count, index, onIndex, onOpen }) {
  const step = (d) => onIndex((index + d + count) % count);
  const swipe = useSwipe(step);
  return (
    <>
      <button type="button" className="backdrop-zoom" aria-label={`${index + 1}. kép nagyban`} onClick={() => onOpen(index)} {...swipe} />
      <div className="backdrop-pager">
        <button type="button" aria-label="Előző kép" onClick={() => step(-1)}>
          <Chevron left />
        </button>
        <span aria-live="polite">
          {index + 1} / {count}
        </span>
        <button type="button" aria-label="Következő kép" onClick={() => step(1)}>
          <Chevron />
        </button>
      </div>
      <div className="backdrop-dots" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <i key={i} data-on={i === index ? '' : undefined} />
        ))}
      </div>
    </>
  );
}

// nagy nézet: az adatlap ablakán belül, a teljes képernyőn
export function GalleryLightbox({ images, title, index, onIndex, onClose }) {
  const boxRef = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  const step = (d) => onIndex((index + d + images.length) % images.length);
  const stepRef = useRef(step);
  stepRef.current = step;
  const swipe = useSwipe(step);
  // a Vissza gomb / gesztus is zárja (saját előzmény-bejegyzés)
  useBackLayer(true, () => closeRef.current());

  // nyitáskor a fókusz a „Bezárás”-ra, záráskor vissza oda, ahonnan nyílt
  useLayoutEffect(() => {
    const from = document.activeElement;
    boxRef.current?.querySelector('.gallery-close')?.focus({ preventScroll: true });
    return () => from?.focus?.({ preventScroll: true });
  }, []);

  // billentyűk: Esc zár (az adatlap Esc-je előtt – a window rögzítő fázisában), nyilak lapoznak
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current();
      else if (e.key === 'ArrowLeft') stepRef.current(-1);
      else if (e.key === 'ArrowRight') stepRef.current(1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // a kiválasztott kis kép látszódjon
  useEffect(() => {
    boxRef.current?.querySelector('.gallery-thumbs [aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [index]);

  const p = images[index];
  return (
    <div ref={boxRef} className="gallery-lightbox" role="dialog" aria-modal="true" aria-label={`${title} – képek`}>
      <div className="gallery-top">
        <span>
          <b>{title}</b>{' '}
          <span className="gallery-counter">
            · {index + 1} / {images.length}
          </span>
        </span>
        <button type="button" className="ghost gallery-close" onClick={onClose}>
          × Bezárás
        </button>
      </div>
      <div className="gallery-stage" {...swipe}>
        <img
          key={p}
          src={IMG + 'w1280' + p}
          srcSet={`${IMG}w780${p} 780w, ${IMG}w1280${p} 1280w`}
          sizes="(max-width: 640px) 100vw, 90vw"
          alt={`${title} – ${index + 1}. kép`}
          decoding="async"
        />
        {images.length > 1 && (
          <>
            <button type="button" className="gallery-nav prev" aria-label="Előző kép" onClick={() => step(-1)}>
              <Chevron left />
            </button>
            <button type="button" className="gallery-nav next" aria-label="Következő kép" onClick={() => step(1)}>
              <Chevron />
            </button>
          </>
        )}
      </div>
      <div className="gallery-thumbs">
        {images.map((q, i) => (
          <button key={q} type="button" aria-label={`${i + 1}. kép`} aria-current={i === index} onClick={() => onIndex(i)}>
            <img src={IMG + 'w300' + q} alt="" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
    </div>
  );
}
