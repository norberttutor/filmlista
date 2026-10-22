'use client';

import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useBackLayer } from '@/lib/backClose';

const LOGO_BASE = 'https://image.tmdb.org/t/p/w185';
const DARK_LIMIT = 0.5; // ennél sötétebb logót fehérre színezünk, hogy a sötét háttéren látsszon
const toneCache = new Map(); // logó URL → sötét-e (oldalanként egyszer számoljuk)

// Franchise-logó; betöltéskor megméri az átlagos világosságát (a TMDB képszervere engedi).
export function FranchiseLogo({ path }) {
  const src = LOGO_BASE + path;
  const [dark, setDark] = useState(() => toneCache.get(src) ?? false);

  function measure(event) {
    if (toneCache.has(src)) return;
    let isDark = false;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 24;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(event.currentTarget, 0, 0, 64, 24);
      const px = ctx.getImageData(0, 0, 64, 24).data;
      let sum = 0;
      let n = 0;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] > 128) {
          sum += (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
          n++;
        }
      }
      isDark = n > 0 && sum / n < DARK_LIMIT;
    } catch {
      // ha a mérés nem sikerül, marad az eredeti szín
    }
    toneCache.set(src, isDark);
    setDark(isDark);
  }

  return (
    <img
      className={dark ? 'franchise-logo dark' : 'franchise-logo'}
      src={src}
      alt=""
      crossOrigin="anonymous"
      loading="lazy"
      onLoad={measure}
    />
  );
}

const GROUP_LABELS = { open: 'Van még megnézendő', done: 'Mind megnézve' };

// Franchise-szűrő saját lenyílóval, mert a beépített <select> nem tud képet mutatni.
// options: [{ value, label, logo, group, badge }] – billentyűzet: nyilak, Home/End, Enter/Szóköz, Esc.
// group ('open' | 'done', terv-3 54): csoportcím a csoport első eleme előtt („Van még megnézendő” /
// „Mind megnézve” – a kész franchise tompán); badge: címke jobbra („2 hátra” / „✓ Mind megnézve”).
// lead="icon" (a műfajszűrő, terv-3 56): a logó helyett kis ikon (o.icon – GenreIcon) keskeny oszlopban.
// Asztalon a szűrősor többi lenyílója is ez (M3, Norbi választása, 2026-10-17 – látványterv:
// https://claude.ai/artifact/KSVj66nfYKQDykEBn312AJ):
//   labelId – külső felirat; label – a gombon belüli kis címke az érték fölött (kétszintű felirat);
//   ariaLabel – látható felirat nélkül (Típus, Rendezés); changed – nem alapértelmezett érték (halvány türkiz);
//   icon – a gomb ikonja, ha a kiválasztottnak nincs saját logója / ikonja; layout="grid" – rácsos panel
//   (asztalon); rootClass – a gyökér osztálya (a franchise- és a műfajszűrőé „franchise-filter”, a többié
//   „filter-select”); o.count – darabszám a sor végén (0-nál a sor halvány)
export default function FranchiseFilter({
  labelId,
  label,
  ariaLabel,
  value,
  options,
  onChange,
  lead = 'logo',
  className,
  rootClass = 'franchise-filter',
  changed = false,
  icon,
  layout,
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];
  // a lista és a gomb felirata: külső felirat, vagy a gombon belüli (látható / rejtett) címke
  const labelledBy = labelId ?? `${id}-label`;

  // a Vissza (telefonon a vissza-gesztus) a nyitott lenyílót zárja, nem az ablakot / lapot
  useBackLayer(open, () => setOpen(false));

  // kattintás a lenyílón kívül: bezár
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  // ha a panel jobbra kilógna a lapból (pl. a széles műfajrács), annyival balra tolódik (--shift, CSS)
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!open || !el) return;
    el.style.removeProperty('--shift');
    const r = el.getBoundingClientRect();
    const over = r.right - (document.documentElement.clientWidth - 12);
    if (over > 0) el.style.setProperty('--shift', `${-Math.min(over, Math.max(0, r.left - 12))}px`);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function openList() {
    setActive(selectedIndex);
    setOpen(true);
  }

  function choose(i) {
    onChange(options[i].value);
    setOpen(false);
    buttonRef.current.focus();
  }

  function handleListKey(event) {
    const last = options.length - 1;
    const next = () => setActive((a) => Math.min(a + 1, last));
    const prev = () => setActive((a) => Math.max(a - 1, 0));
    const keys = {
      ArrowDown: next,
      ArrowUp: prev,
      // rácsban oldalra is (sorfolytonosan)
      ...(layout === 'grid' && { ArrowRight: next, ArrowLeft: prev }),
      Home: () => setActive(0),
      End: () => setActive(last),
      Enter: () => choose(active),
      ' ': () => choose(active),
      Escape: () => {
        setOpen(false);
        buttonRef.current.focus();
      },
    };
    if (keys[event.key]) {
      event.preventDefault();
      keys[event.key]();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  return (
    <div className={className ? `${rootClass} ${className}` : rootClass} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="franchise-filter-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelledBy} ${id}-value`}
        data-changed={changed || undefined}
        data-labeled={label ? '' : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openList();
          }
        }}
      >
        {selected.logo ? <FranchiseLogo path={selected.logo} /> : (selected.icon ?? icon)}
        {label ? (
          <span className="ff-text">
            <span id={`${id}-label`} className="ff-label">
              {label}
            </span>
            <span id={`${id}-value`} className="ff-value">
              {selected.label}
            </span>
          </span>
        ) : (
          <>
            {ariaLabel && (
              <span id={`${id}-label`} className="sr-only">
                {ariaLabel}
              </span>
            )}
            <span id={`${id}-value`}>{selected.label}</span>
          </>
        )}
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          className={layout === 'grid' ? 'franchise-listbox ff-grid' : 'franchise-listbox'}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelledBy}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={handleListKey}
        >
          {options.map((o, i) => (
            <Fragment key={o.value}>
              {o.group && o.group !== options[i - 1]?.group && (
                <li className="franchise-group" role="presentation">
                  {GROUP_LABELS[o.group]}
                </li>
              )}
              <li
                id={`${id}-opt-${i}`}
                data-index={i}
                data-done={o.group === 'done' || undefined}
                data-zero={o.count === 0 || undefined}
                role="option"
                aria-selected={o.value === value}
                className={i === active ? 'active' : undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                {lead === 'icon' ? (
                  <span className="icon-slot">{o.icon}</span>
                ) : (
                  <span className="logo-slot">{o.logo && <FranchiseLogo path={o.logo} />}</span>
                )}
                <span className="franchise-name">{o.label}</span>
                {o.count !== undefined && (
                  <>
                    <span className="sr-only">, </span>
                    <span className="ff-count">{o.count}</span>
                  </>
                )}
                {o.badge && (
                  <>
                    <span className="sr-only">, </span>
                    <span className="franchise-badge">{o.badge}</span>
                  </>
                )}
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}
