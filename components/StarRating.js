'use client';

import { useId, useState } from 'react';

const STARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function Star() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95z" />
    </svg>
  );
}

const STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

// Szerkeszthető 10 csillagos értékelés. Valójában rádiógombok, a kiválasztott csillagra
// újra kattintva törlődik (null). Billentyűzettel a nyilak (Home / End) csak előnézetet
// mutatnak – a natív rádiógomb minden lépésnél mentene –, az Enter / Szóköz véglegesít.
export default function StarRating({ name, label, value, onChange }) {
  const [hover, setHover] = useState(0);
  // az imént választott érték: a csillagai egymás után "pattannak" (betöltéskor nem)
  const [popped, setPopped] = useState(0);
  const hintId = useId();
  const shown = hover || value || 0;

  function choose(n) {
    setPopped(n ?? 0);
    onChange(n);
  }

  function onKeyDown(e) {
    const n = Number(e.target.dataset.n);
    if (!n) return;
    let to;
    if (e.key in STEP) to = Math.min(STARS.length, Math.max(1, n + STEP[e.key]));
    else if (e.key === 'Home') to = 1;
    else if (e.key === 'End') to = STARS.length;
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (n !== value) choose(n);
      return;
    } else return;
    e.preventDefault();
    setHover(to);
    e.currentTarget.querySelector(`input[data-n="${to}"]`)?.focus();
  }

  return (
    <div
      className={hover ? 'stars previewing' : 'stars'}
      role="radiogroup"
      aria-label={label}
      aria-describedby={hintId}
      onMouseLeave={() => setHover(0)}
      onKeyDown={onKeyDown}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHover(0)}
    >
      <span id={hintId} className="sr-only">
        Nyilakkal válassz, Enter vagy Szóköz: mentés.
      </span>
      {STARS.map((n) => (
        <label
          key={n}
          className={[n <= shown && 'on', n <= popped && 'pop'].filter(Boolean).join(' ') || undefined}
          style={n <= popped ? { '--i': n - 1 } : undefined}
          onMouseEnter={() => setHover(n)}
          onAnimationEnd={() => n === popped && setPopped(0)}
        >
          <input
            type="radio"
            className="sr-only"
            name={name}
            data-n={n}
            aria-label={`${n} csillag`}
            checked={value === n}
            onChange={() => choose(n)}
            onClick={() => value === n && choose(null)}
          />
          <Star />
        </label>
      ))}
    </div>
  );
}

// Csak megjelenítés (kártyán).
export function StarsDisplay({ value }) {
  return (
    <span className="stars-static" role="img" aria-label={`Értékelés: ${value}/10`}>
      {STARS.map((n) => (
        <span key={n} className={n <= value ? 'on' : undefined}>
          <Star />
        </span>
      ))}
    </span>
  );
}
