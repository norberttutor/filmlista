'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  NEXT_SEASON_STATUS,
  seasonAired,
  setSeasonStatus,
  setSeasonDownloaded,
  markAllSeasonsWatched,
  restoreSeasons,
  addSeason,
  removeLastSeason,
  updateTitle,
  formatDate,
  todayDate,
  DEFAULT_STATUS,
  DROPPED_STATUS,
} from '@/lib/titles';

// Évadok a sorozatoknál: évadcsík (táblázat, kártya), évadlista (a sorból lenyíló panelben és a
// szerkesztő ablakban) és a közös műveletek. A sorozat állapotát az adatbázis számolja, kivéve
// az "Abbahagyva"-t (kézi: "Nem nézem tovább" / "Mégis folytatom").

const STATUS_TEXT = { to_watch: 'nincs megnézve', watching: 'folyamatban', watched: 'megnézve' };

// van-e évadlistája a címnek (csak sorozatnál; évadok nélkül marad a kézi állapot)
export const hasSeasons = (t) => t.media_type === 'tv' && t.seasons?.length > 0;

// névelő a sorszám elé: "az 1.", "az 5.", "az 50.", egyébként "a"
export const article = (n) => (n === 1 || String(n).startsWith('5') ? 'az' : 'a');

// évadszámok tömören: [1, 2, 3, 5] → "1–3., 5."
export function seasonRange(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j > i ? `${sorted[i]}–${sorted[j]}.` : `${sorted[i]}.`);
    i = j;
  }
  return parts.join(', ');
}

// { aired, watched }: a megjelent évadok száma és ebből a megnézetteké
export function seasonCounts(t) {
  const aired = t.seasons.filter((s) => seasonAired(s));
  return { aired: aired.length, watched: aired.filter((s) => s.status === 'watched').length };
}

// a sorozat állapota az évadokból, ahogy az adatbázis is számolja (az azonnali megjelenítéshez):
// minden megjelent évad megnézve → Megnézve; van megkezdett / megnézett → Folyamatban
function statusFromSeasons(t) {
  const aired = t.seasons.filter((s) => seasonAired(s));
  if (aired.length > 0 && aired.every((s) => s.status === 'watched')) return 'watched';
  return t.seasons.some((s) => s.status !== DEFAULT_STATUS) ? 'watching' : DEFAULT_STATUS;
}

// "2019 · 8 rész", bejelentett évadnál "hamarosan: 2026. 03. 12." / "bejelentve"
function seasonInfo(s, aired) {
  if (!aired) return s.air_date ? `hamarosan: ${formatDate(s.air_date)}` : 'bejelentve';
  return [s.air_date?.slice(0, 4), s.episode_count && `${s.episode_count} rész`]
    .filter(Boolean)
    .join(' · ');
}

// Évadműveletek: azonnal látszanak (optimista), a szerver friss sora (a sorozat új
// állapotával) felülírja, hibánál visszaáll. A kitöltött / tömegesen jelölt évadok egy
// ideig visszavonhatók (note).
export function useSeasonActions(title, onUpdated, onError) {
  const [note, setNote] = useState(null); // { text, previous }
  const noteTimer = useRef(null);
  useEffect(() => () => clearTimeout(noteTimer.current), []);

  const withSeasons = (numbers, changes) => ({
    ...title,
    seasons: title.seasons.map((s) => (numbers.includes(s.season_number) ? { ...s, ...changes } : s)),
  });

  async function run(optimistic, action) {
    const before = title;
    if (optimistic) onUpdated(optimistic);
    onError('');
    try {
      const result = await action();
      onUpdated(result.row ?? result);
      return result;
    } catch (err) {
      onUpdated(before);
      onError(err.message);
      return null;
    }
  }

  // dropped: a művelet előtt "Abbahagyva" volt (a visszavonás azt is visszaállítja)
  function showNote(result, text, dropped = false) {
    clearTimeout(noteTimer.current);
    setNote({ text, previous: result.previous, dropped });
    noteTimer.current = setTimeout(() => setNote(null), 10000);
  }

  async function setStatus(number, status) {
    const filled =
      status === 'watched'
        ? title.seasons
            .filter((s) => s.season_number < number && s.status === 'to_watch' && seasonAired(s))
            .map((s) => s.season_number)
        : [];
    const changes = { status, ...(status === 'watched' && { is_downloaded: false }) };
    const result = await run(withSeasons([number, ...filled], changes), () =>
      setSeasonStatus(title, number, status)
    );
    if (result?.filled.length) showNote(result, `${seasonRange(result.filled)} évad is megnézve.`);
  }

  // "Mind megnézve": minden megjelent évad megnézett lesz; az "Abbahagyva"-t is feloldja
  // (a sorozat így Megnézve)
  async function allWatched() {
    const numbers = title.seasons
      .filter((s) => seasonAired(s) && s.status !== 'watched')
      .map((s) => s.season_number);
    const dropped = title.status === DROPPED_STATUS;
    if (numbers.length === 0 && !dropped) return;
    const marked = withSeasons(numbers, { status: 'watched', is_downloaded: false });
    const result = await run(
      dropped ? { ...marked, status: statusFromSeasons(marked) } : marked,
      async () => {
        const done = await markAllSeasonsWatched(title);
        return dropped
          ? { ...done, row: await updateTitle(title.id, { status: DEFAULT_STATUS }) }
          : done;
      }
    );
    if (result && (result.filled.length || dropped)) {
      const text = result.filled.length
        ? `Megnézve: ${seasonRange(result.filled)} évad.`
        : 'A sorozat megnézve.';
      showNote(result, text, dropped);
    }
  }

  async function undo() {
    const { previous, dropped } = note;
    clearTimeout(noteTimer.current);
    setNote(null);
    const restore = new Map(previous.map((p) => [p.season_number, p]));
    await run(
      {
        ...title,
        seasons: title.seasons.map((s) => ({ ...s, ...restore.get(s.season_number) })),
        ...(dropped && { status: DROPPED_STATUS }),
      },
      async () => {
        const row = await restoreSeasons(title.id, previous);
        return dropped ? updateTitle(title.id, { status: DROPPED_STATUS }) : row;
      }
    );
  }

  // "Nem nézem tovább" / "Mégis folytatom". Folytatáskor az adatbázis az évadokból számolja
  // újra a sorozat állapotát (bármit küldünk, ami nem "Abbahagyva").
  function setDropped(dropped) {
    return run(
      { ...title, status: dropped ? DROPPED_STATUS : statusFromSeasons(title) },
      () => updateTitle(title.id, { status: dropped ? DROPPED_STATUS : DEFAULT_STATUS })
    );
  }

  return {
    note,
    setStatus,
    allWatched,
    undo,
    setDropped,
    setDownloaded: (number, value) =>
      run(withSeasons([number], { is_downloaded: value }), () =>
        setSeasonDownloaded(title.id, number, value)
      ),
    add: () => run(null, () => addSeason(title)),
    removeLast: () =>
      run({ ...title, seasons: title.seasons.slice(0, -1) }, () => removeLastSeason(title)),
  };
}

// Évadcsík: szakaszonként egy évad az állapotszínével, a bejelentett szaggatott. Ha van
// onCycle, a megjelent évadra kattintva lépteti az állapotot (üres → Folyamatban → Megnézve).
export function SeasonStrip({ title, onCycle }) {
  const today = todayDate();
  const { aired, watched } = seasonCounts(title);
  return (
    <span
      className="season-strip"
      role={onCycle ? 'group' : 'img'}
      aria-label={`${title.title} – évadok: ${watched}/${aired} megnézve`}
    >
      {title.seasons.map((s) => {
        const isAired = seasonAired(s, today);
        const info = `${s.season_number}. évad · ${seasonInfo(s, isAired)}`;
        const label = isAired ? `${info} · ${STATUS_TEXT[s.status]}` : info;
        return onCycle && isAired ? (
          <button
            key={s.season_number}
            type="button"
            className="season"
            data-status={s.status}
            title={label}
            aria-label={`${label} – kattintásra: ${STATUS_TEXT[NEXT_SEASON_STATUS[s.status]]}`}
            onClick={() => onCycle(s.season_number, NEXT_SEASON_STATUS[s.status])}
          />
        ) : (
          <span
            key={s.season_number}
            className="season"
            data-status={s.status}
            data-upcoming={isAired ? undefined : ''}
            title={label}
            aria-hidden={onCycle ? undefined : 'true'}
          />
        );
      })}
    </span>
  );
}

const SEASON_CHOICES = [
  { code: 'watching', name: 'Folyamatban' },
  { code: 'watched', name: 'Megnézve' },
];

// Évadlista: évadonként állapot (a kiválasztottra újra kattintva üres) és "Letöltve";
// alul "Mind megnézve", "Nem nézem tovább" / "Mégis folytatom", "+ Évad hozzáadása",
// "Utolsó évad törlése" (megerősítéssel), visszavonás.
export function SeasonList({ title, actions }) {
  const id = useId();
  const today = todayDate();
  const wrapRef = useRef(null);
  const removeRef = useRef(null);
  const [confirming, setConfirming] = useState(false);
  const last = title.seasons.at(-1)?.season_number;
  const dropped = title.status === DROPPED_STATUS;

  function cancelRemove() {
    flushSync(() => setConfirming(false));
    removeRef.current?.focus();
  }

  async function remove() {
    setConfirming(false);
    await actions.removeLast();
    wrapRef.current?.focus();
  }
  return (
    <div className="season-list-wrap" ref={wrapRef} tabIndex={-1}>
      {/* felolvasó is jelzi, ha "Nem nézem tovább"-ra vált (üresen nem foglal helyet) */}
      <div role="status">
        {dropped && (
          <p className="season-dropped">
            Abbahagyva: nem nézed tovább, az új évadok sem változtatnak rajta.
          </p>
        )}
      </div>
      <ul className="season-list">
        {title.seasons.map((s) => {
          const n = s.season_number;
          const isAired = seasonAired(s, today);
          return (
            <li key={n} data-upcoming={isAired ? undefined : ''}>
              <span className="season-head">
                <span className="season-title">{n}. évad</span>
                <span className="season-info">{seasonInfo(s, isAired)}</span>
              </span>
              {isAired && (
                <>
                  <span className="segmented" role="radiogroup" aria-label={`${n}. évad állapota`}>
                    {SEASON_CHOICES.map((c) => (
                      <label key={c.code}>
                        <input
                          type="radio"
                          name={`${id}-s${n}`}
                          checked={s.status === c.code}
                          onChange={() => actions.setStatus(n, c.code)}
                          onClick={() => s.status === c.code && actions.setStatus(n, 'to_watch')}
                        />
                        <span>{c.name}</span>
                      </label>
                    ))}
                  </span>
                  <label className="check">
                    <input
                      type="checkbox"
                      aria-label={`${n}. évad letöltve`}
                      checked={s.is_downloaded}
                      onChange={(e) => actions.setDownloaded(n, e.target.checked)}
                    />
                    <span aria-hidden="true">Letöltve</span>
                  </label>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <p className="season-note" role="status">
        {actions.note && (
          <>
            {actions.note.text}{' '}
            {/* a gomb eltűnik: a fókusz a listán marad (billentyűzettel se vesszen el) */}
            <button
              type="button"
              className="link"
              onClick={() => {
                actions.undo();
                wrapRef.current?.focus();
              }}
            >
              Visszavonás
            </button>
          </>
        )}
      </p>
      {confirming ? (
        <div className="season-actions">
          <span className="season-confirm-text">
            <span className="confirm-text">
              Törlöd {article(last)} {last}. évadot?
            </span>
            <span className="muted small">
              Ha a TMDB-n is szerepel, a heti frissítés üresen visszahozza.
            </span>
          </span>
          <span className="season-actions-group">
            <button type="button" className="ghost mini" autoFocus onClick={cancelRemove}>
              Mégse
            </button>
            <button type="button" className="danger mini" onClick={remove}>
              Igen, törlés
            </button>
          </span>
        </div>
      ) : (
        <div className="season-actions">
          <span className="season-actions-group">
            <button type="button" className="ghost mini" onClick={actions.allWatched}>
              Mind megnézve
            </button>
            {/* ugyanaz a gomb vált feliratot, így a fókusz rajta marad */}
            <button
              type="button"
              className="ghost mini"
              onClick={() => actions.setDropped(!dropped)}
            >
              {dropped ? 'Mégis folytatom' : 'Nem nézem tovább'}
            </button>
          </span>
          <span className="season-actions-group">
            <button type="button" className="ghost mini" onClick={actions.add}>
              + Évad hozzáadása
            </button>
            <button
              type="button"
              className="ghost mini"
              ref={removeRef}
              onClick={() => setConfirming(true)}
            >
              Utolsó évad törlése
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

// A táblázat Állapot cellája sorozatnál: évadcsík (kattintható), alatta "3/5 évad", ami
// lenyitja az évadlistát (a sor nem lesz magasabb). Kattintás kívül / Esc: bezár.
export function SeasonCell({ title, onUpdated, onError }) {
  const actions = useSeasonActions(title, onUpdated, onError);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const { aired, watched } = seasonCounts(title);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) panelRef.current?.querySelector('input, button')?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <div className="season-cell" ref={rootRef}>
      <SeasonStrip title={title} onCycle={actions.setStatus} />
      <button
        ref={buttonRef}
        type="button"
        className="season-count"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        {watched}/{aired} évad
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      {title.status === DROPPED_STATUS && <span className="season-dropped-tag">Abbahagyva</span>}
      {!open && actions.note && (
        <span className="season-note" role="status">
          {actions.note.text}{' '}
          <button
            type="button"
            className="link"
            onClick={() => {
              actions.undo();
              buttonRef.current?.focus(); // a gomb eltűnik: a fókusz a "3/5 évad"-ra kerül
            }}
          >
            Visszavonás
          </button>
        </span>
      )}
      {open && (
        <div
          id={panelId}
          ref={panelRef}
          className="season-panel"
          role="dialog"
          aria-label={`${title.title} – évadok`}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              close();
            }
          }}
        >
          <SeasonList title={title} actions={actions} />
        </div>
      )}
    </div>
  );
}

// A táblázat Letöltve cellája sorozatnál: a letöltött évadok (szerkesztés az évadlistában)
export function SeasonDownloads({ title }) {
  const numbers = title.seasons.filter((s) => s.is_downloaded).map((s) => s.season_number);
  if (numbers.length === 0) return null;
  const range = seasonRange(numbers);
  return (
    <span className="season-dl" title={`Letöltött évad: ${range}`}>
      <span className="sr-only">Letöltött évad: </span>
      {range}
    </span>
  );
}
