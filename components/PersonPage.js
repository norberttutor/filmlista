'use client';

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { addTitle, titleKey, releaseState, todayDate } from '@/lib/titles';
import { followKey, followPerson, unfollowPerson, useFollowed, PERSON_V } from '@/lib/people';
import { useSlidingThumb } from '@/lib/useSlidingThumb';
import OnList from '@/components/OnList';

const IMG = 'https://image.tmdb.org/t/p/';
const REST_SHOWN = 10; // ennyi „további” cím látszik, a többi a „Továbbiak mutatása” után
const longDate = new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const formatLong = (d) => longDate.format(new Date(`${d}T00:00:00Z`));

function age(from, to) {
  const [y, m, d] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

// a még meg nem jelent cím (indigó szaggatott – terv-3 52.1): a listán lévőnél a releaseState,
// a többinél a TMDB dátuma (nincs, vagy jövőbeli)
export function isUpcoming(credit, row, today) {
  if (row) return releaseState(row, today)?.kind === 'soon';
  return !credit.release_date || credit.release_date > today;
}

export const kindLabel = (c) =>
  c.media_type === 'tv' ? `Sorozat${c.episode_count ? ` · ${c.episode_count} rész` : ''}` : 'Film';

// A borítóról nyíló adatlap (onPreview) a keresés találatainak mezőivel
export const asItem = (c) => ({
  media_type: c.media_type,
  tmdb_id: c.tmdb_id,
  title: c.title,
  original_title: c.original_title,
  release_year: c.release_year,
  poster_path: c.poster_path,
});

// A szerep felvétele a listára (a színész lapja és a követett személy idővonala – M4 – közös része):
// { adding: a felvétel alatt álló cím ({ key, watched }), errors: kulcs → hibaüzenet, add(c, watched) }
export function useAddCredit(onAdded) {
  const [adding, setAdding] = useState(null);
  const [errors, setErrors] = useState({});
  // watched: „Már láttam” (terv-3 80) – megnézettként kerül fel
  async function add(c, watched = false) {
    const key = titleKey(c);
    setAdding({ key, watched });
    setErrors((e) => ({ ...e, [key]: '' }));
    try {
      onAdded(await addTitle({ media_type: c.media_type, tmdb_id: c.tmdb_id }, null, { watched }));
    } catch (err) {
      setErrors((e) => ({ ...e, [key]: err.message }));
    }
    setAdding(null);
  }
  return { adding, errors, add };
}

// a cím állapota: listán (megnézve / saját csillag) vagy „+ Hozzáadás” / „Már láttam”; row: a listán
// lévő sor
export function CreditStatus({ c, row, adding, add, readOnly }) {
  if (!row) {
    if (readOnly) return null;
    const busy = adding?.key === titleKey(c);
    return (
      <>
        <button
          type="button"
          className="ghost mini"
          disabled={busy}
          aria-label={`Hozzáadás a listához: ${c.title}`}
          onClick={() => add(c)}
        >
          {busy && !adding.watched ? 'Hozzáadás…' : '+ Hozzáadás'}
        </button>
        {/* már látott cím: megnézettként kerül fel (terv-3 80) */}
        <button
          type="button"
          className="ghost mini"
          disabled={busy}
          aria-label={`Már láttam: ${c.title}`}
          onClick={() => add(c, true)}
        >
          {busy && adding.watched ? 'Hozzáadás…' : 'Már láttam'}
        </button>
      </>
    );
  }
  const done = row.status === 'watched' || row.status === 'dropped';
  return (
    <>
      <OnList item={row}>{row.status === 'watched' ? 'Megnézve' : 'A listán'}</OnList>
      {done && row.my_rating && (
        <span className="person-rating" aria-label={`Saját értékelés: ${row.my_rating}/10`}>
          ★ {row.my_rating}
        </span>
      )}
    </>
  );
}

// „Követem” (M4): a gomb és a magyarázata; hibánál helyben üzenet (az értesítősáv nyitott ablak fölött
// nem kattintható). person: { id, name, profile_path }
export function FollowButton({ person, role, readOnly }) {
  const followed = useFollowed();
  const [error, setError] = useState('');
  const on = followed.has(followKey(person.id, role));
  if (readOnly && !on) return null;
  async function toggle() {
    setError('');
    try {
      if (on) await unfollowPerson(person.id, role);
      else await followPerson(person, role);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="follow-row">
      <button type="button" className="follow-btn" aria-pressed={on} disabled={readOnly} onClick={toggle}>
        {on ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="10" cy="8" r="4" />
            <path d="M3 20c.8-3.5 3.6-5.5 7-5.5 1.3 0 2.5.3 3.5.8" />
            <path d="M18 14v6M15 17h6" />
          </svg>
        )}
        Követem
      </button>
      {on && (
        <span className="follow-note">
          {role === 'director' ? 'Szólok, ha új filmjét jelentik be.' : 'Szólok, ha új főszerepét jelentik be.'}
        </span>
      )}
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// „Főszerepek | Összes szerep” (M4): főszerep – filmben a stáblista első 3 helye, sorozatban legalább 6 rész
export function RoleSwitch({ allRoles, onChange, leadCount, allCount }) {
  return (
    <div className="role-switch sliding" role="group" aria-label="Szerepek" ref={useSlidingThumb()}>
      <button type="button" aria-pressed={!allRoles} onClick={() => onChange(false)}>
        Főszerepek ({leadCount})
      </button>
      <button type="button" aria-pressed={allRoles} onClick={() => onChange(true)}>
        Összes szerep ({allCount})
      </button>
    </div>
  );
}

// Egy színész lapja az adatlapon belül (terv-3 61, Norbi választása, 2026-10-12: a „kevert”
// látványterv). A Szereplők nevére kattintva nyílik, a TitleEditor új lapjaként („‹ Vissza”).
// Fölül az adatai és az életrajza, alatta „A listádon” (borítórács: megnézett szürkén, saját
// csillag, még meg nem jelent indigó szaggatott), majd „További filmjei és sorozatai” soronként,
// az ismertebbek elöl, animáció / dokumentum / talkshow, vendégszereplés és borító nélküliek nélkül
// (a listán lévők ezekből is látszanak). A borítóra kattintva a cím adatlapja (onPreview), a „+
// Hozzáadás” felveszi. A csoportosítás a lap megnyitásakori listából – a most felvett cím a helyén
// marad („✓ A listán”). readOnly: net nélkül nincs felvétel.
// M4: „Követem” gomb a név alatt; a „További” részben alapból a főszerepek („Főszerepek | Összes
// szerep”). cast.role: 'director' – az adatlap „Rendező” sorából: a rendezett filmjei (kapcsoló nélkül).
export default function PersonPage({ person: cast, titles, active, apiRef, back, onBack, onPreview, onAdded, readOnly }) {
  const role = cast.role ?? 'actor';
  const director = role === 'director';
  const [load, setLoad] = useState({ status: 'loading', person: null, credits: [], error: '' });
  const [attempt, setAttempt] = useState(0);
  const [allShown, setAllShown] = useState(false);
  const [allRoles, setAllRoles] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  const [bioLong, setBioLong] = useState(false);
  const { adding, errors, add } = useAddCredit(onAdded);
  const bioRef = useRef(null);
  // a megnyitáskori lista: ebből dől el, mi kerül „A listádon” csoportba
  const [initialKeys] = useState(() => new Set(titles.map(titleKey)));
  const rows = new Map(titles.map((t) => [titleKey(t), t]));
  const today = todayDate();

  useEffect(() => {
    const controller = new AbortController();
    setLoad((l) => ({ ...l, status: 'loading', error: '' }));
    apiGet('/api/tmdb/person', { id: cast.id, role, v: PERSON_V }, { signal: controller.signal })
      .then((data) => setLoad({ status: 'done', person: data.person, credits: data.credits, error: '' }))
      .catch((err) => err.name !== 'AbortError' && setLoad((l) => ({ ...l, status: 'error', error: err.message })));
    return () => controller.abort();
  }, [cast.id, role, attempt]);

  // a „Tovább” csak akkor kell, ha az életrajz nem fér el a 4 sorban
  useLayoutEffect(() => {
    const el = bioRef.current;
    if (el && !bioOpen) setBioLong(el.scrollHeight > el.clientHeight + 2);
  }, [load.person, bioOpen, active]);

  // felvétel közben a lap nem hagyható el (a Vissza és a kikattintás vár)
  useImperativeHandle(apiRef, () => ({ canLeave: () => !adding }));

  const p = load.person ?? { name: cast.name, profile_path: cast.profile_path };
  const credits = load.credits;
  const mine = credits.filter((c) => initialKeys.has(titleKey(c)));
  const others = credits.filter((c) => !c.minor && !initialKeys.has(titleKey(c)));
  const leadOthers = others.filter((c) => c.lead);
  const rest = director || allRoles ? others : leadOthers;
  const restShown = allShown ? rest : rest.slice(0, REST_SHOWN);

  const status = (c) => <CreditStatus c={c} row={rows.get(titleKey(c))} adding={adding} add={add} readOnly={readOnly} />;

  function itemProps(c) {
    const row = rows.get(titleKey(c));
    return {
      'data-status': row?.status,
      'data-upcoming': isUpcoming(c, row, today) ? '' : undefined,
    };
  }

  function poster(c, size) {
    const row = rows.get(titleKey(c));
    const path = row?.poster_path ?? c.poster_path;
    return (
      <button type="button" className="similar-poster" aria-label={`${c.title} adatlapja`} onClick={() => onPreview(asItem(c))}>
        {path && <img src={IMG + size + path} alt="" loading="lazy" />}
      </button>
    );
  }

  const soon = (c) => itemProps(c)['data-upcoming'] === '' && <span className="person-soon">Hamarosan</span>;

  const facts = load.person && (
    <p className="person-facts">
      <span>
        <b>{director ? 'Rendező' : 'Színész'}</b>
      </span>
      {p.birthday && (
        <span>
          Született: {formatLong(p.birthday)}
          {!p.deathday && ` (${age(p.birthday, today)} éves)`}
        </span>
      )}
      {p.deathday && (
        <span>
          Elhunyt: {formatLong(p.deathday)}
          {p.birthday && ` (${age(p.birthday, p.deathday)} évesen)`}
        </span>
      )}
      {p.place_of_birth && <span>{p.place_of_birth}</span>}
    </p>
  );
  const tmdbLink = (className) => (
    <a className={`person-tmdb ${className}`} href={`https://www.themoviedb.org/person/${cast.id}`} target="_blank" rel="noopener noreferrer">
      Megnyitás a TMDB-n ↗
    </a>
  );

  return (
    <div className="editor-page person-page" hidden={!active}>
      {/* a form csak az elrendezés miatt (a cím adatlapjának kétoszlopos rácsa); nincs mit küldeni */}
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="editor-side">
          <div className="editor-poster" aria-hidden="true">
            {p.profile_path && <img src={IMG + 'w500' + p.profile_path} alt="" decoding="async" />}
          </div>
          {tmdbLink('side')}
        </div>
        <div className="editor-main">
          <header>
            {back && (
              <button type="button" className="back-link" onClick={onBack}>
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Vissza: {back}</span>
              </button>
            )}
            <div className="person-head">
              {/* keskenyebben (< 900 px, nincs bal oszlop) kerek fotó a név mellett */}
              <span className="person-photo" aria-hidden="true">
                {p.profile_path && <img src={IMG + 'w185' + p.profile_path} alt="" />}
              </span>
              <div>
                <h2 id={active ? 'editor-title' : undefined} tabIndex={-1}>
                  {p.name}
                </h2>
                {facts}
                <FollowButton
                  person={{ id: cast.id, name: p.name, profile_path: p.profile_path }}
                  role={role}
                  readOnly={readOnly}
                />
              </div>
            </div>
            {p.biography && (
              <>
                {/* a nyelvjelzés az életrajz előtt – a „Tovább” után „Tovább angolul”-nak olvasódott (I5) */}
                {p.bio_lang === 'en' && <p className="trailer-lang person-bio-lang">Életrajz · angolul</p>}
                <p ref={bioRef} className={bioOpen ? 'editor-overview person-bio open' : 'editor-overview person-bio'}>
                  {p.biography}
                </p>
                <div className="person-bio-row">
                  {(bioLong || bioOpen) && (
                    <button type="button" className="link small" aria-expanded={bioOpen} onClick={() => setBioOpen((o) => !o)}>
                      {bioOpen ? 'Kevesebb' : 'Tovább'}
                    </button>
                  )}
                  {tmdbLink('inline')}
                </div>
              </>
            )}
            {load.status === 'done' && !p.biography && <div className="person-bio-row">{tmdbLink('inline')}</div>}
          </header>

          {load.status === 'loading' && (
            <div className="similar-sk person-sk" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className="sk-card">
                  <span className="sk sk-poster" />
                  <span className="sk sk-line sk-w80" />
                </span>
              ))}
            </div>
          )}
          {load.status === 'loading' && (
            <p className="sr-only" role="status">
              {p.name} filmjeinek betöltése…
            </p>
          )}
          {load.status === 'error' && (
            <div className="person-error">
              <p className="error small" role="alert">
                {load.error}
              </p>
              <button type="button" className="ghost mini" onClick={() => setAttempt((n) => n + 1)}>
                Újrapróbálás
              </button>
            </div>
          )}
          {load.status === 'done' && !load.person && (
            <p className="muted small">Ez a személy már nincs meg a TMDB-n.</p>
          )}

          {mine.length > 0 && (
            <section className="person-section" aria-labelledby={`person-mine-${cast.id}`}>
              <h3 className="person-section-title" id={`person-mine-${cast.id}`}>
                A listádon <span className="person-count">{mine.length}</span>
              </h3>
              <ul className="person-grid">
                {mine.map((c) => {
                  const key = titleKey(c);
                  return (
                    <li key={key} className="similar-item" {...itemProps(c)}>
                      {poster(c, 'w185')}
                      <span className="similar-title">{c.title}</span>
                      <span className="similar-meta">{[c.release_year, kindLabel(c)].filter(Boolean).join(' · ')}</span>
                      {c.character && <span className="person-role">{c.character}</span>}
                      <span className="person-status">
                        {soon(c)}
                        {status(c)}
                      </span>
                      {errors[key] && <span className="error small">{errors[key]}</span>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {others.length > 0 && (
            <section className="person-section" aria-labelledby={`person-rest-${cast.id}`}>
              <div className="person-section-head">
                <h3 className="person-section-title" id={`person-rest-${cast.id}`}>
                  {director
                    ? mine.length > 0 ? 'További filmjei' : 'Filmjei'
                    : mine.length > 0 ? 'További filmjei és sorozatai' : 'Filmjei és sorozatai'}{' '}
                  <span className="person-count">{rest.length}</span>
                </h3>
                {!director && (
                  <RoleSwitch
                    allRoles={allRoles}
                    onChange={(v) => {
                      setAllRoles(v);
                      setAllShown(false);
                    }}
                    leadCount={leadOthers.length}
                    allCount={others.length}
                  />
                )}
              </div>
              <p className="person-note">
                {director
                  ? 'Az ismertebbek elöl. Animáció és dokumentumfilm nélkül.'
                  : allRoles
                    ? 'Az ismertebbek elöl. Animáció és vendégszereplés nélkül.'
                    : 'Az ismertebbek elöl. Főszerep: a stáblista első 3 helye (sorozatnál legalább 6 rész).'}
              </p>
              {rest.length === 0 && <p className="muted small">Nincs további főszerepe. Az összes szerepét a kapcsolóval nézheted meg.</p>}
              <ul className="person-rows">
                {restShown.map((c) => {
                  const key = titleKey(c);
                  return (
                    <li key={key} className="person-row" {...itemProps(c)}>
                      {poster(c, 'w92')}
                      <span className="person-row-text">
                        <span className="person-row-title" title={c.title}>
                          {c.title}
                        </span>
                        <span className="person-row-meta">
                          {c.release_year ?? '–'} · {kindLabel(c)}
                          {c.character && (
                            <>
                              {' · '}
                              <span className="person-role">{c.character}</span>
                            </>
                          )}
                        </span>
                        {errors[key] && <span className="error small">{errors[key]}</span>}
                      </span>
                      <span className="person-row-side">
                        {soon(c)}
                        {status(c)}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {rest.length > restShown.length && (
                <button type="button" className="ghost person-more" onClick={() => setAllShown(true)}>
                  Továbbiak mutatása ({rest.length - restShown.length})
                </button>
              )}
            </section>
          )}

          {load.status === 'done' && load.person && credits.length === 0 && (
            <p className="muted small">A TMDB-n nincs filmje vagy sorozata.</p>
          )}
        </div>
      </form>
    </div>
  );
}
