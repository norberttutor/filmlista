'use client';

import { useRef, useState } from 'react';
import { titleKey } from '@/lib/titles';
import { HideButton } from '@/components/HideSuggestion';

const IMG = 'https://image.tmdb.org/t/p/';
const MONTHS = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
const SWIPE_PX = 50; // ennyi vízszintes húzás lapoz (telefonon)

// „júl. 29.”; más évben „2025. júl. 29.”
function cinemaDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const day = `${MONTHS[m - 1]} ${d}.`;
  return y === new Date().getFullYear() ? day : `${y}. ${day}`;
}

function runtimeText(min) {
  const h = Math.floor(min / 60);
  return h ? `${h} óra${min % 60 ? ` ${min % 60} perc` : ''}` : `${min} perc`;
}

// Kiemelt sáv a Felfedezés tetején (terv-3 46, Norbi választása: „A” látványterv –
// munka/terv-3/terv-46/): a „Most a mozikban” első címei egyenként, nagy jelenetképpel, logóval
// (ha nincs, a cím), évvel, műfajjal, játékidővel, a mozis bemutató napjával, a leírással és az
// „Adatlap” / „+ Hozzáadás” gombbal. Lapozás: ‹ / › és a pöttyök, asztalon alatta a kis képek,
// telefonon ujjal húzva. Magától nem lapoz (Norbi döntése). A nem listán lévőn × („Nem érdekel”).
export default function FeaturedBand({ items, existingKeys, rowState, onAdd, onPreview, onHide }) {
  const [index, setIndex] = useState(0);
  const swipe = useRef(null);
  const count = items.length;
  // ha egy kiemelt eltűnik (elrejtve), a hely a következőé; a végén az utolsó marad
  const current = Math.min(index, count - 1);
  const it = items[current];
  const go = (i) => setIndex(((i % count) + count) % count);

  const key = titleKey(it);
  const onList = existingKeys.has(key);
  const state = rowState[key] ?? {};
  const meta = [it.release_year, it.genres?.join(', '), it.runtime && runtimeText(it.runtime)].filter(Boolean).join(' · ');

  return (
    <section className="featured" aria-roledescription="kiemelések" aria-labelledby="featured-title">
      <div className="featured-head">
        <h3 id="featured-title">Kiemelt a mozikban</h3>
        <span className="featured-count" aria-live="polite">
          {current + 1} / {count}
        </span>
      </div>
      <div
        className="featured-slide"
        aria-roledescription="kiemelés"
        aria-label={`${current + 1} / ${count}: ${it.title}`}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse') swipe.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (swipe.current === null) return;
          const dx = e.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) >= SWIPE_PX && count > 1) go(current + (dx < 0 ? 1 : -1));
        }}
        onPointerCancel={() => (swipe.current = null)}
      >
        <div className="featured-bg" style={{ backgroundImage: `url(${IMG}w1280${it.backdrop_path})` }} />
        {!onList && <HideButton item={it} onHide={onHide} />}
        <div className="featured-body">
          {it.logo_path ? (
            <h4 className="featured-logo">
              <img src={`${IMG}w500${it.logo_path}`} alt={it.title} />
            </h4>
          ) : (
            <h4 className="featured-name">{it.title}</h4>
          )}
          <p className="featured-meta">
            {meta}
            {it.cinema_date && (
              <>
                {' · '}
                <span className="featured-when">moziban {cinemaDay(it.cinema_date)} óta</span>
              </>
            )}
          </p>
          {it.overview && <p className="featured-overview">{it.overview}</p>}
          <div className="featured-actions">
            <button type="button" className="ghost" onClick={() => onPreview(it, null)}>
              Adatlap
            </button>
            {onList ? (
              <span className="on-list">✓ A listán</span>
            ) : (
              <button type="button" className="ghost featured-add" disabled={state.busy} onClick={() => onAdd(it)}>
                {state.busy ? 'Hozzáadás…' : '+ Hozzáadás'}
              </button>
            )}
          </div>
          {state.error && (
            <p className="error small" role="alert">
              {state.error}
            </p>
          )}
        </div>
        {count > 1 && (
          <div className="featured-nav">
            <div className="featured-dots">
              {items.map((x, i) => (
                <button
                  key={titleKey(x)}
                  type="button"
                  className={i === current ? 'on' : undefined}
                  aria-label={`${i + 1}. kiemelés: ${x.title}`}
                  aria-current={i === current || undefined}
                  onClick={() => go(i)}
                />
              ))}
            </div>
            <button type="button" className="featured-arrow" aria-label="Előző kiemelés" onClick={() => go(current - 1)}>
              ‹
            </button>
            <button type="button" className="featured-arrow" aria-label="Következő kiemelés" onClick={() => go(current + 1)}>
              ›
            </button>
          </div>
        )}
      </div>
      {count > 1 && (
        <div className="featured-thumbs" aria-hidden="true">
          {items.map((x, i) => (
            <button
              key={titleKey(x)}
              type="button"
              tabIndex={-1}
              className={i === current ? 'on' : undefined}
              style={{ backgroundImage: `url(${IMG}w300${x.backdrop_path})` }}
              onClick={() => go(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
