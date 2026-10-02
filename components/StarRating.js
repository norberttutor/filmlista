'use client';

import { useState } from 'react';

const STARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function Star() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95z" />
    </svg>
  );
}

// Szerkeszthető 10 csillagos értékelés. Valójában rádiógombok (billentyűzettel a
// nyilakkal állítható), a kiválasztott csillagra újra kattintva törlődik (null).
export default function StarRating({ name, label, value, onChange }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;

  return (
    <div
      className={hover ? 'stars previewing' : 'stars'}
      role="radiogroup"
      aria-label={label}
      onMouseLeave={() => setHover(0)}
    >
      {STARS.map((n) => (
        <label key={n} className={n <= shown ? 'on' : undefined} onMouseEnter={() => setHover(n)}>
          <input
            type="radio"
            className="sr-only"
            name={name}
            aria-label={`${n} csillag`}
            checked={value === n}
            onChange={() => onChange(n)}
            onClick={() => value === n && onChange(null)}
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
