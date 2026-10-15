'use client';

import { useState } from 'react';
import { useMediaQuery } from '@/lib/useMediaQuery';

const PHOTO_BASE = 'https://image.tmdb.org/t/p/w185';
const TOP = 3;
const PHONE_QUERY = '(max-width: 640px)';

// Szereplők az adatlapon (terv-3 38, Norbi választása, 2026-10-06): a top cast első 3 tagja
// (/api/tmdb/credits). „side”: asztalon a bal oszlopban a „Hol nézhető?” alatt – kerek fotó, név,
// szerep egymás alatt (az „A” látványterv); „inline”: keskenyebben (< 900 px) egy szöveges sor a
// leírás alatt. A névre (asztalon a fotóra is) kattintva a színész lapja nyílik az ablakon belül
// (onPerson – terv-3 61; korábban a TMDB-oldalára vitt). Ha nincs adat, semmi nem látszik.
// Összes szereplő (terv-3 91, 2026-10-14): ha több van (a route legfeljebb 20-at ad), alattuk „Összes szereplő
// (N)” – kibontva a többi is (asztalon a bal oszlopban, keskenyebben a sor alatt, fotóval), „Kevesebb” csukja.
// Telefonon (≤ 640 px) nincs: csak az első 3 név (Norbi kérése, 2026-10-15).
export default function TopCast({ cast, variant, onPerson }) {
  const [expanded, setOpen] = useState(false);
  const phone = useMediaQuery(PHONE_QUERY);
  if (!cast?.length) return null;
  const top = cast.slice(0, TOP);
  const rest = phone ? [] : cast.slice(TOP);
  const open = expanded && rest.length > 0;

  const person = (p) => (
    <li key={p.id}>
      <button type="button" className="cast-person" onClick={() => onPerson(p)}>
        <span className="cast-photo">{p.profile_path && <img src={PHOTO_BASE + p.profile_path} alt="" loading="lazy" />}</span>
        <span className="cast-text">
          <span className="cast-name">{p.name}</span>
          {p.character && <small>{p.character}</small>}
        </span>
      </button>
    </li>
  );
  const toggle = rest.length > 0 && (
    <button type="button" className="link small cast-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
      {open ? 'Kevesebb' : `Összes szereplő (${cast.length})`}
    </button>
  );

  if (variant === 'inline') {
    return (
      <div className="cast-inline" data-open={open ? '' : undefined}>
        <p className="cast-line">
          <b>Szereplők:</b>{' '}
          {top.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <button type="button" className="cast-name" onClick={() => onPerson(p)}>
                {p.name}
              </button>
            </span>
          ))}
          {toggle && <> · {toggle}</>}
        </p>
        {open && (
          <ul className="cast-all" aria-label="További szereplők">
            {rest.map(person)}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="cast side" data-open={open ? '' : undefined}>
      <span className="watch-title" aria-hidden="true">
        Szereplők
      </span>
      <ul aria-label="Szereplők">
        {top.map(person)}
        {open && rest.map(person)}
      </ul>
      {toggle}
    </div>
  );
}
