'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { titleKey } from '@/lib/titles';
import { followKey, followPerson, useFollowed } from '@/lib/people';
import Reflow, { HIDE_EXIT } from '@/components/Reflow';

const IMG = 'https://image.tmdb.org/t/p/';
const SUGGEST_SEEDS = 40; // a 8+ értékelésűek közül ennyi (a route MAX_SEEDS-e)
const SHOWN = 6;
const TITLES_NAMED = 2; // a magyarázatban ennyi cím neve
// a /api/people/suggest kérés v paramétere: a böngésző egy napig tárolja a választ – a mezők / a
// számolás változásakor emeld
const SUGGEST_V = 1;

const hiddenKey = (userId) => `filmlista-kovetes-rejtett:${userId}`;

function loadHidden(userId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(hiddenKey(userId)) ?? '[]'));
  } catch {
    return new Set();
  }
}

function saveHidden(userId, hidden) {
  try {
    localStorage.setItem(hiddenKey(userId), JSON.stringify([...hidden]));
  } catch {
    // tiltott tárhely (privát ablak): csak erre a megnyitásra marad elrejtve
  }
}

// a kiinduló címek: a 8+ saját értékelésűek, a legjobb elöl, egyenlőségnél a legutóbb megnézett
export function suggestSeeds(titles) {
  const when = (t) => t.watched_at ?? t.created_at ?? '';
  return titles
    .filter((t) => t.my_rating >= 8 && t.tmdb_id != null)
    .sort((a, b) => b.my_rating - a.my_rating || when(b).localeCompare(when(a)))
    .slice(0, SUGGEST_SEEDS)
    .map(titleKey);
}

// „Kit érdemes követned?” (terv-3 111) a Színészek és rendezők ablakban: akik a 8+ saját értékelésű
// címeid stábjában (a stáblista első 5 helye, filmnél a rendező) a leggyakoribbak – legalább 2 címben –,
// és még nem követed őket. „Követem” egy kattintással (a csempéje rögtön megjelenik alatta), a × elrejti
// (böngészőnként, felhasználónként – localStorage). A névre / fotóra kattintva a személy lapja
// (onPerson). Ha nincs javaslat, vagy a TMDB nem válaszol, a sáv elmarad (mint a kiemelt sáv).
export default function FollowSuggestions({ titles, userId, onPerson }) {
  const followed = useFollowed();
  const [people, setPeople] = useState(null);
  const [hidden, setHidden] = useState(() => loadHidden(userId));
  const [errors, setErrors] = useState({});
  const listRef = useRef(null);

  // a megnyitáskori kedvencekből (a közben adott értékelés a következő megnyitáskor számít)
  const [seeds] = useState(() => suggestSeeds(titles));
  useEffect(() => {
    if (seeds.length < 2) return;
    const controller = new AbortController();
    apiGet('/api/people/suggest', { ids: seeds.join(','), v: SUGGEST_V }, { signal: controller.signal })
      .then((data) => setPeople(data.people))
      .catch((err) => err.name !== 'AbortError' && console.warn('A követési javaslat nem tölthető be:', err.message));
    return () => controller.abort();
  }, [seeds]);

  const rows = useMemo(() => new Map(titles.map((t) => [titleKey(t), t])), [titles]);
  const shown = (people ?? [])
    .filter((p) => !followed.has(followKey(p.id, p.role)) && !hidden.has(followKey(p.id, p.role)))
    .slice(0, SHOWN);
  if (shown.length === 0) return null;

  function hide(p) {
    const next = new Set(hidden).add(followKey(p.id, p.role));
    setHidden(next);
    saveHidden(userId, next);
  }

  async function follow(p) {
    const key = followKey(p.id, p.role);
    setErrors((e) => ({ ...e, [key]: '' }));
    try {
      await followPerson({ id: p.id, name: p.name, profile_path: p.profile_path }, p.role);
    } catch (err) {
      setErrors((e) => ({ ...e, [key]: err.message }));
    }
  }

  return (
    <section className="follow-suggest" aria-labelledby="follow-suggest-title">
      <h3 id="follow-suggest-title" className="follow-suggest-title">
        Kit érdemes követned?
      </h3>
      <p className="follow-suggest-note">A 8+ csillagos címeid gyakori szereplői és rendezői.</p>
      {/* elrejtéskor / követéskor a többi a helyére csúszik (terv-3 137) */}
      <Reflow trigger={shown.map((p) => followKey(p.id, p.role)).join()} boxRef={listRef} exit={() => HIDE_EXIT}>
        <ul className="follow-suggest-list" ref={listRef}>
          {shown.map((p) => {
            const key = followKey(p.id, p.role);
            const names = p.keys.map((k) => rows.get(k)?.title).filter(Boolean);
            const open = () => onPerson({ id: p.id, name: p.name, profile_path: p.profile_path, role: p.role });
            return (
              <li key={key} className="follow-suggest-item" data-flip={key}>
                <button type="button" className="follow-suggest-photo" tabIndex={-1} aria-hidden="true" onClick={open}>
                  {p.profile_path && <img src={`${IMG}w185${p.profile_path}`} alt="" loading="lazy" />}
                </button>
                <span className="follow-suggest-text">
                  <button type="button" className="follow-suggest-name" onClick={open}>
                    {p.name}
                  </button>
                  <span className="follow-suggest-meta">
                    {p.role === 'director' ? 'Rendező' : 'Színész'} · {p.keys.length} kedvenced
                    {names.length > 0 && `: ${names.slice(0, TITLES_NAMED).join(', ')}${names.length > TITLES_NAMED ? '…' : ''}`}
                  </span>
                  {errors[key] && <span className="error small">{errors[key]}</span>}
                </span>
                <button type="button" className="ghost mini" aria-label={`Követem: ${p.name}`} onClick={() => follow(p)}>
                  Követem
                </button>
                <button
                  type="button"
                  className="follow-suggest-hide"
                  aria-label={`Nem kell: ${p.name}`}
                  title="Nem kell"
                  onClick={() => hide(p)}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      </Reflow>
    </section>
  );
}
