'use client';

import { useEffect, useId, useRef, useState } from 'react';

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

// Franchise-szűrő saját lenyílóval, mert a beépített <select> nem tud képet mutatni.
// options: [{ value, label, logo }] – billentyűzet: nyilak, Home/End, Enter/Szóköz, Esc
export default function FranchiseFilter({ labelId, value, options, onChange }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const selected = options[selectedIndex];

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
    const keys = {
      ArrowDown: () => setActive((a) => Math.min(a + 1, last)),
      ArrowUp: () => setActive((a) => Math.max(a - 1, 0)),
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
    <div className="franchise-filter" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="franchise-filter-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${id}-value`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openList();
          }
        }}
      >
        {selected.logo && <FranchiseLogo path={selected.logo} />}
        <span id={`${id}-value`}>{selected.label}</span>
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          className="franchise-listbox"
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={`${id}-opt-${active}`}
          onKeyDown={handleListKey}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              className={i === active ? 'active' : undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(i)}
            >
              <span className="logo-slot">{o.logo && <FranchiseLogo path={o.logo} />}</span>
              <span>{o.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
