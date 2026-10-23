'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { titleKey, todayDate, formatReleaseDate } from '@/lib/titles';
import { useFollowed, followKey, personSummary, PERSON_V } from '@/lib/people';
import { fold } from '@/lib/listSearch';
import { useBackdropClose } from '@/lib/useBackdropClose';
import { useSlidingThumb } from '@/lib/useSlidingThumb';
import { CollectionMeter } from '@/components/FranchiseCollection';
import FollowSuggestions from '@/components/FollowSuggestions';
import DialogClose from '@/components/DialogClose';
import { CreditStatus, FollowButton, RoleSwitch, useAddCredit, isUpcoming, kindLabel, asItem } from '@/components/PersonPage';

const IMG = 'https://image.tmdb.org/t/p/';
const PARALLEL = 3; // egyszerre ennyi személy filmjeit kéri le
const TIMELINE_SHOWN = 20; // az idővonalon ennyi cím látszik, a többi a „Továbbiak mutatása” után

const byName = (a, b) => a.name.localeCompare(b.name, 'hu');

// a két csoport fülként (Norbi kérése, 2026-10-18): egyszerre csak az egyik látszik
const TABS = [
  { id: 'actor', label: 'Színészek', empty: 'Még nem követsz színészt.' },
  { id: 'director', label: 'Rendezők', empty: 'Még nem követsz rendezőt.' },
];

// ⋮ „Színészek és rendezők” (M4, Norbi választása, 2026-10-17 – munka/terv-3/terv-m4/): a követett
// személyek csempéi ábécérendben, két fülön (Színészek | Rendezők). Asztalon portrérács (álló fotó – „B”), telefonon
// vízszintes csempék (kerek fotó – „A”); csak a CSS más. Csempénként mérő és „x/y megnézve · m további
// főszerep” (a megnézettek a listán lévők közül; a további: a listán nem lévő, már megjelent
// főszerepek), és ha van, a legközelebbi dátummal bejelentett főszerepe (indigó). A számok a
// személyek filmjeiből (/api/tmdb/person) jönnek, egyszerre 3-asával. Csempére kattintva az ablakon
// belül az idővonal (PersonTimeline); az Esc / Vissza onnan a csempékhez lép vissza.
// Kikattintásra zár, kivéve ha épp cím kerül fel a listára (az idővonalon). Net nélkül a menüpont nincs; ha
// nyitva megy el a net (readOnly – B9), nincs felvétel, követés-váltás és javaslat.
// onPreview(item): a borítóra kattintva a cím adatlapja (az ablak fölött nyílik); onPerson(személy): a
// követési javaslat (terv-3 111) nevére kattintva a személy lapja (szintén az ablak fölött).
export default function PeopleDialog({ titles, userId, onClose, onPreview, onPerson, onAdded, readOnly }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const followed = useFollowed();
  const [query, setQuery] = useState('');
  // a választott fül; alapból a Színészek, ha csak rendezőt követ, a Rendezők
  const [tab, setTab] = useState(() =>
    [...followed.values()].some((p) => p.role === 'actor') || followed.size === 0 ? 'actor' : 'director',
  );
  const tabRefs = useRef({});
  const tabsThumb = useSlidingThumb(); // csúszó kijelölő a füleken (terv-3 100)
  const [open, setOpen] = useState(null); // a megnyitott személy kulcsa (idővonal)
  const [details, setDetails] = useState(new Map()); // kulcs → { status, data, error }
  const [attempt, setAttempt] = useState(0); // „Újrapróbálás”: a hibás személy újra sorra kerül
  const busyRef = useRef(false); // felvétel közben (az idővonalon) nem zár
  const scrollTop = useRef(0);
  const closing = { onClose: () => dialogRef.current.close(), canClose: () => !busyRef.current };
  const backdrop = useBackdropClose(dialogRef, closing);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
  }, []);

  // a személyek filmjei 3-asával (a már betöltöttek és a hibásak kimaradnak). A betöltés alattiak is sorra
  // kerülnek (B3): az előző kör takarítása leállította őket – a details itt még a takarítás előtti
  const people = [...followed.values()];
  const peopleKey = people.map((p) => followKey(p.person_id, p.role)).join(',');
  useEffect(() => {
    const queue = people.filter((p) => {
      const d = details.get(followKey(p.person_id, p.role));
      return !d || d.status === 'loading';
    });
    if (queue.length === 0) return;
    let cancelled = false;
    setDetails((d) => {
      const next = new Map(d);
      for (const p of queue) next.set(followKey(p.person_id, p.role), { status: 'loading' });
      return next;
    });
    const run = async () => {
      while (queue.length && !cancelled) {
        const p = queue.shift();
        const key = followKey(p.person_id, p.role);
        try {
          const data = await apiGet('/api/tmdb/person', { id: p.person_id, role: p.role, v: PERSON_V });
          if (!cancelled) setDetails((d) => new Map(d).set(key, { status: 'done', data }));
        } catch (err) {
          if (!cancelled) setDetails((d) => new Map(d).set(key, { status: 'error', error: err.message }));
        }
      }
    };
    for (let i = 0; i < PARALLEL; i++) run();
    return () => {
      cancelled = true;
      // a félbehagyottak újra sorra kerülnek
      setDetails((d) => new Map([...d].filter(([, v]) => v.status !== 'loading')));
    };
    // a details szándékosan nincs benne: csak az új követés (és az „Újrapróbálás”) indít betöltést
  }, [peopleKey, attempt]);

  const rows = useMemo(() => new Map(titles.map((t) => [titleKey(t), t])), [titles]);
  const today = todayDate();
  const q = fold(query.trim());
  const shown = people.filter((p) => !q || fold(p.name).includes(q));
  const actors = shown.filter((p) => p.role === 'actor').sort(byName);
  const directors = shown.filter((p) => p.role === 'director').sort(byName);
  const groups = { actor: actors, director: directors };
  // keresésnél, ha a választott fülön nincs találat, de a másikon van, az látszik
  const other = tab === 'actor' ? 'director' : 'actor';
  const activeTab = q && groups[tab].length === 0 && groups[other].length > 0 ? other : tab;
  const openPerson = open ? followed.get(open) : null;

  function openTimeline(key) {
    scrollTop.current = dialogRef.current.scrollTop;
    setOpen(key);
  }
  // a fókusz a személy csempéjére kerül vissza (billentyűzettel ott folytatható); ha már nincs ott (közben
  // nem követett), az ablak címére
  function backToTiles() {
    if (busyRef.current) return;
    const key = open;
    setOpen(null);
    requestAnimationFrame(() => {
      const d = dialogRef.current;
      if (!d) return;
      d.scrollTop = scrollTop.current;
      const tileButton = d.querySelector(`.people-main[data-key="${key}"]`);
      if (tileButton) tileButton.focus({ preventScroll: true });
      else headingRef.current?.focus({ preventScroll: true });
    });
  }

  // az idővonalról az Esc a csempékhez lép vissza – már a billentyűnél, nem a „cancel” letiltásával: a
  // letiltott „cancel” után a Chrome a következő Esc-et (felhasználói művelet nélkül) nem adja át, így az ablak
  // nem zárult be. Az ablak fölött nyitott adatlap bezárása után a fókusz a body-ra esik – az is ide tartozik.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      const d = dialogRef.current;
      const active = document.activeElement;
      if (e.key !== 'Escape' || e.defaultPrevented || !d?.open) return;
      if (active !== document.body && !d.contains(active)) return; // egy másik ablakban (pl. az adatlapon)
      if (document.querySelector('dialog.title-editor[open]')) return; // az adatlap van fölül: az zárul
      e.preventDefault();
      backToTiles();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // a követés megszüntetése után is nyitva marad az idővonal (a „Követem” visszakapcsolható)
  const [kept, setKept] = useState(null);
  useEffect(() => {
    if (openPerson) setKept(openPerson);
  }, [openPerson]);
  const timelinePerson = openPerson ?? (open ? kept : null);

  function tile(p) {
    const key = followKey(p.person_id, p.role);
    const d = details.get(key);
    const s = d?.status === 'done' ? personSummary(d.data.credits, rows, today) : null;
    return (
      <li key={key} className="people-tile">
        <button type="button" className="people-main" data-key={key} onClick={() => openTimeline(key)}>
          <span className="people-photo">
            {p.profile_path && <img src={`${IMG}w185${p.profile_path}`} alt="" loading="lazy" />}
          </span>
          <span className="people-text">
            <span className="people-name">{p.name}</span>
            <CollectionMeter watched={s?.watched ?? 0} onList={s?.onList ?? 0} />
            <span className="people-count">
              {s ? (
                <>
                  <b>
                    {s.watched}/{s.onList}
                  </b>{' '}
                  megnézve<span className="people-dot"> · </span>
                  <span className="people-more">
                    {s.more} további {p.role === 'director' ? 'film' : 'főszerep'}
                  </span>
                </>
              ) : d?.status === 'error' ? (
                'Most nem tölthető be'
              ) : (
                '…'
              )}
            </span>
            {s?.soon && (
              <span className="people-soon">
                {s.soon.title} · {formatReleaseDate(s.soon.release_date)}
              </span>
            )}
          </span>
        </button>
      </li>
    );
  }

  function tabKey(e) {
    const i = TABS.findIndex((t) => t.id === activeTab);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = TABS[(to + TABS.length) % TABS.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  const current = TABS.find((t) => t.id === activeTab);
  const list = groups[activeTab];

  return (
    <dialog
      ref={dialogRef}
      className="editor stats-dialog people-dialog"
      aria-labelledby="people-title"
      // a Vissza gomb „cancel”-t küld: az idővonalról a csempékhez lép (az Esc-et a fenti figyelő kezeli)
      onCancel={(e) => {
        if (open) {
          e.preventDefault();
          backToTiles();
        }
      }}
      onClose={(e) => e.target === e.currentTarget && onClose()}
      {...backdrop}
    >
      <DialogClose dialogRef={dialogRef} {...closing} />
      {timelinePerson ? (
        <PersonTimeline
          key={open}
          person={timelinePerson}
          detail={details.get(open)}
          rows={rows}
          today={today}
          onBack={backToTiles}
          onPreview={onPreview}
          onAdded={onAdded}
          busyRef={busyRef}
          readOnly={readOnly}
          onRetry={() => {
            setDetails((d) => new Map([...d].filter(([k]) => k !== open)));
            setAttempt((n) => n + 1);
          }}
        />
      ) : (
        <div>
          <header className="stats-head">
            <h2 id="people-title" ref={headingRef} tabIndex={-1}>
              Színészek és rendezők
            </h2>
            <p>{people.length > 0 ? `${people.length} követett · ábécérendben` : 'Még nem követsz senkit'}</p>
          </header>

          {/* keresés közben nem kell (a követettek között keresel) */}
          {!q && !readOnly && <FollowSuggestions titles={titles} userId={userId} onPerson={onPerson} />}

          {people.length === 0 ? (
            <p className="muted people-empty">
              Egy film adatlapján a szereplő vagy a rendező nevére kattintva megnyílik a lapja: ott a „Követem”
              gombbal veheted fel ide. Szólok, ha új főszerepét vagy filmjét jelentik be.
            </p>
          ) : (
            <>
              <div className="people-bar">
                <div className="dialog-tabs people-tabs sliding" ref={tabsThumb} role="tablist" aria-label="Csoport">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      ref={(el) => (tabRefs.current[t.id] = el)}
                      type="button"
                      role="tab"
                      id={`people-tab-${t.id}`}
                      aria-selected={activeTab === t.id}
                      aria-controls="people-panel"
                      tabIndex={activeTab === t.id ? 0 : -1}
                      onClick={() => setTab(t.id)}
                      onKeyDown={tabKey}
                    >
                      {t.label}
                      <span className="people-tab-count">{groups[t.id].length}</span>
                    </button>
                  ))}
                </div>
                <input
                  type="search"
                  className="franchises-search"
                  aria-label="Keresés a követettek között"
                  placeholder="Keresés a követettek között"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div role="tabpanel" id="people-panel" aria-labelledby={`people-tab-${activeTab}`} className="people-group">
                {shown.length === 0 ? (
                  <p className="muted">Nincs ilyen követett személy: „{query.trim()}”.</p>
                ) : list.length === 0 ? (
                  <p className="muted people-empty">
                    {current.empty} Egy film adatlapján a nevére kattintva a lapján a „Követem” gombbal veheted fel.
                  </p>
                ) : (
                  <ul className="people-grid">{list.map(tile)}</ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </dialog>
  );
}

// A követett személy filmjei megjelenés szerint (M4, a 4. kép): legfelül a még meg nem jelentek
// („Hamarosan” – indigó), alatta évenként, a legújabb elöl. A listán lévők mindig (mellékszerepben is),
// a többiből a főszerepek („Főszerepek | Összes szerep”). A borítóra kattintva a cím adatlapja; a „+
// Hozzáadás” / „Már láttam” felveszi (felvétel közben az ablak nem zár, a Vissza vár).
function PersonTimeline({ person, detail, rows, today, onBack, onPreview, onAdded, busyRef, onRetry, readOnly }) {
  const director = person.role === 'director';
  const [allRoles, setAllRoles] = useState(false);
  const [allShown, setAllShown] = useState(false);
  const { adding, errors, add } = useAddCredit(onAdded);
  const headingRef = useRef(null);
  busyRef.current = !!adding;

  useLayoutEffect(() => {
    headingRef.current?.focus();
    headingRef.current?.closest('dialog')?.scrollTo(0, 0);
  }, []);

  const credits = detail?.status === 'done' ? detail.data.credits : [];
  const p = detail?.data?.person ?? { name: person.name, profile_path: person.profile_path };
  const lead = personSummary(credits, rows, today);
  const all = personSummary(credits, rows, today, true);
  const list = (allRoles ? all : lead).shown;
  const upcoming = (c) => isUpcoming(c, rows.get(titleKey(c)), today);
  // a bejelentettek (dátum nélkül a végén) fölül, utána a legújabb elöl
  const ordered = [...list].sort((a, b) => {
    const ua = upcoming(a);
    const ub = upcoming(b);
    if (ua !== ub) return ua ? -1 : 1;
    const da = a.release_date ?? (ua ? '9999' : '0000');
    const db = b.release_date ?? (ub ? '9999' : '0000');
    return ua ? da.localeCompare(db) : db.localeCompare(da);
  });
  const visible = allShown ? ordered : ordered.slice(0, TIMELINE_SHOWN);

  const items = [];
  let year = null;
  for (const c of visible) {
    const y = upcoming(c) ? 'Hamarosan' : (c.release_year ?? '–');
    if (y !== year) {
      items.push(
        <li key={`y:${y}`} className="timeline-year" data-upcoming={y === 'Hamarosan' ? '' : undefined} aria-hidden="true">
          {y}
        </li>
      );
      year = y;
    }
    const key = titleKey(c);
    const row = rows.get(key);
    const path = row?.poster_path ?? c.poster_path;
    const soon = upcoming(c);
    items.push(
      <li
        key={key}
        className="person-row timeline-row"
        data-status={row?.status}
        data-mine={row ? '' : undefined}
        data-upcoming={soon ? '' : undefined}
      >
        <button type="button" className="similar-poster" aria-label={`${c.title} adatlapja`} onClick={() => onPreview(asItem(c))}>
          {path && <img src={IMG + 'w92' + path} alt="" loading="lazy" />}
        </button>
        <span className="person-row-text">
          <span className="person-row-title" title={c.title}>
            {c.title}
          </span>
          <span className="person-row-meta">
            {/* az év a csoport fejlécében; a bejelentettnél a dátum */}
            {soon && <span className="timeline-when">{c.release_date ? formatReleaseDate(c.release_date) : 'Bejelentve'} · </span>}
            {kindLabel(c)}
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
          <CreditStatus c={c} row={row} adding={adding} add={add} readOnly={readOnly} />
        </span>
      </li>
    );
  }

  return (
    <div className="people-timeline">
      <button type="button" className="back-link" onClick={onBack}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Vissza: Színészek és rendezők</span>
      </button>
      <div className="person-head">
        <span className="person-photo" aria-hidden="true">
          {p.profile_path && <img src={IMG + 'w185' + p.profile_path} alt="" />}
        </span>
        <div>
          <h2 id="people-title" ref={headingRef} tabIndex={-1}>
            {p.name}
          </h2>
          <p className="person-facts">
            <span>
              <b>{director ? 'Rendező' : 'Színész'}</b>
            </span>
            {detail?.status === 'done' && (
              <>
                <span>
                  {lead.watched}/{lead.onList} megnézve a listádon
                </span>
                <span>
                  {lead.more} további {director ? 'film' : 'főszerep'}
                </span>
              </>
            )}
          </p>
          <FollowButton person={{ id: person.person_id, name: person.name, profile_path: person.profile_path }} role={person.role} readOnly={readOnly} />
        </div>
      </div>

      <div className="person-section-head">
        <h3 className="person-section-title">Filmjei megjelenés szerint</h3>
        {!director && detail?.status === 'done' && (
          <RoleSwitch
            allRoles={allRoles}
            onChange={(v) => {
              setAllRoles(v);
              setAllShown(false);
            }}
            leadCount={lead.shown.length}
            allCount={all.shown.length}
          />
        )}
      </div>
      <p className="person-note">
        {director
          ? 'A listádon lévők mindig látszanak. Animáció és dokumentumfilm nélkül.'
          : 'A listádon lévők mindig látszanak, mellékszerepben is. Animáció és vendégszereplés nélkül.'}
      </p>

      {(!detail || detail.status === 'loading') && (
        <p className="muted small" role="status">
          {p.name} filmjeinek betöltése…
        </p>
      )}
      {detail?.status === 'error' && (
        <div className="person-error">
          <p className="error small" role="alert">
            {detail.error}
          </p>
          <button type="button" className="ghost mini" onClick={onRetry}>
            Újrapróbálás
          </button>
        </div>
      )}
      {detail?.status === 'done' && ordered.length === 0 && <p className="muted small">A TMDB-n nincs ilyen filmje.</p>}

      <ul className="timeline">{items}</ul>
      {ordered.length > visible.length && (
        <button type="button" className="ghost person-more" onClick={() => setAllShown(true)}>
          Továbbiak mutatása ({ordered.length - visible.length})
        </button>
      )}
    </div>
  );
}
