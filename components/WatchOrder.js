'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_STATUS, DROPPED_STATUS, restoreSeasons, setSeasonStatus, todayDate, updateTitle } from '@/lib/titles';
import { clearOrder, itemDone, itemLabel, itemMeta, nextItem, orderedItems, saveOrder } from '@/lib/watchOrder';
import { seasonRange } from '@/components/Seasons';
import StarRating from '@/components/StarRating';
import ShareOrder from '@/components/ShareOrder';

const THUMB = 'https://image.tmdb.org/t/p/w92';

// A franchise gyűjtemény-ablakának „Nézési sorrend” füle (terv-3 28): a franchise listán lévő
// filmjei és a sorozatok évadjai egy számozott listában, a saját sorrendben (amíg nincs ilyen,
// megjelenés szerint). A megnézett tétel kihúzva a helyén marad, az első meg nem nézett (megjelent,
// nem abbahagyott) „Következik”. A jelölőnégyzet a cím / az évad állapotát állítja (mint a
// listán); ha ettől a cím megnézett lett és még nincs értékelése, a tétel alatt „Hogy tetszett?”
// (az ablak fölött az értesítősáv nem kattintható). „Sorrend szerkesztése”: húzás a fogantyúnál
// (egérrel, ujjal) vagy ↑ / ↓; „Kész” egyben menti, „Megjelenés szerint” + „Kész” törli a saját
// sorrendet. A szerkesztés állapota (editing) a gyűjtemény-ablaké: közben nem zár kikattintásra,
// az Esc csak a szerkesztést zárja. „Megosztás” (terv-3 41, ShareOrder): csak olvasható nyilvános
// link a sorrendhez; onShareBusyChange – a visszavonás megerősítése alatt az ablak ne záródjon
// kikattintásra.
export default function WatchOrder({
  franchise,
  titles,
  orders,
  editing,
  onEditingChange,
  onOrderChanged,
  onUpdated,
  onShareBusyChange,
}) {
  const { items, stored } = orderedItems(franchise.id, titles, orders);
  const [draft, setDraft] = useState(null); // szerkesztés közben a tételkulcsok sorrendje
  const [reset, setReset] = useState(false); // „Megjelenés szerint” után (azóta nem mozdult)
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState({}); // tételkulcs → mentés folyamatban
  const [asking, setAsking] = useState(null); // tételkulcs: alatta „Hogy tetszett?”
  const [struck, setStruck] = useState(null); // tételkulcs: most pipálva – a kihúzás behúzódik
  const [note, setNote] = useState(null); // { text, titleId, previous } – kitöltött évadok
  const noteTimer = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [moved, setMoved] = useState(null); // { key, dir }: a mozgatás után a fókusz visszaadása
  const [announce, setAnnounce] = useState('');
  const listRef = useRef(null);
  useEffect(() => () => clearTimeout(noteTimer.current), []);

  // a szerkesztést kívülről (Esc) is le lehet zárni: akkor a vázlat elvész
  if (!editing && draft) setDraft(null);

  const byKey = new Map(items.map((i) => [i.key, i]));
  const shown = draft
    ? [...draft.map((k) => byKey.get(k)).filter(Boolean), ...items.filter((i) => !draft.includes(i.key))]
    : items;
  const next = nextItem(shown);
  const watched = items.filter(itemDone).length;

  useEffect(() => {
    if (!moved) return;
    const li = listRef.current?.querySelector(`[data-key="${moved.key}"]`);
    const button = li?.querySelector(moved.dir < 0 ? '.wo-up' : '.wo-down');
    (button && !button.disabled ? button : li?.querySelector('.wo-move button:not(:disabled)'))?.focus();
  }, [moved]);

  function startEdit() {
    setDraft(items.map((i) => i.key));
    setReset(false);
    setError('');
    setAsking(null);
    onEditingChange(true);
  }

  function cancelEdit() {
    setDraft(null);
    onEditingChange(false);
  }

  function byRelease() {
    setDraft(orderedItems(franchise.id, titles, []).items.map((i) => i.key));
    setReset(true);
    setAnnounce('Megjelenés szerinti sorrend');
  }

  async function finish() {
    const keys = shown.map((i) => i.key);
    const changed = keys.join() !== items.map((i) => i.key).join();
    setSaving(true);
    setError('');
    try {
      if (reset && stored) {
        await clearOrder(franchise.id);
        onOrderChanged(franchise.id, []);
      } else if (changed || (stored && !reset)) {
        onOrderChanged(franchise.id, await saveOrder(franchise.id, shown));
      }
      setDraft(null);
      onEditingChange(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function moveKey(key, toIndex) {
    setDraft((d) => {
      const keys = d ?? shown.map((i) => i.key);
      const from = keys.indexOf(key);
      if (from < 0 || toIndex < 0 || toIndex >= keys.length || from === toIndex) return d;
      const out = [...keys];
      out.splice(from, 1);
      out.splice(toIndex, 0, key);
      return out;
    });
    setReset(false);
  }

  function step(i, index, dir) {
    moveKey(i.key, index + dir);
    setMoved({ key: i.key, dir });
    setAnnounce(`${itemLabel(i)}: ${index + dir + 1}. hely`);
  }

  // húzás a fogantyúnál: a mutató alatti tétel helyére kerül (a lista közben átrendeződik);
  // az ablak szélén görget. A figyelők az ablakon vannak, mert az átrendezéskor a fogantyú a
  // DOM-ban máshová kerül (az elkapás elveszne).
  function startDrag(e, i) {
    if (e.button !== 0) return;
    e.preventDefault();
    const list = listRef.current;
    const scroller = list.closest('dialog');
    setDragging(i.key);
    const onMove = (ev) => {
      const box = scroller.getBoundingClientRect();
      if (ev.clientY < box.top + 56) scroller.scrollBy(0, -12);
      else if (ev.clientY > box.bottom - 56) scroller.scrollBy(0, 12);
      const rows = [...list.children];
      const target = rows.findIndex((li) => {
        const r = li.getBoundingClientRect();
        return ev.clientY >= r.top && ev.clientY < r.bottom;
      });
      if (target >= 0 && rows[target].dataset.key !== i.key) moveKey(i.key, target);
    };
    const end = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      setDragging(null);
      const at = [...list.children].findIndex((li) => li.dataset.key === i.key);
      setAnnounce(`${itemLabel(i)}: ${at + 1}. hely`);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  function showNote(text, titleId, previous) {
    clearTimeout(noteTimer.current);
    setNote({ text, titleId, previous });
    noteTimer.current = setTimeout(() => setNote(null), 10000);
  }

  async function undoNote() {
    const n = note;
    setNote(null);
    try {
      onUpdated(await restoreSeasons(n.titleId, n.previous));
    } catch (err) {
      setError(err.message);
    }
  }

  // kipipálás / visszavonás: filmnél (és évad nélküli sorozatnál) a cím állapota, évadnál az évadé
  async function toggle(i) {
    const t = i.title;
    const status = itemDone(i) ? DEFAULT_STATUS : 'watched';
    setError('');
    setAsking(null);
    setStruck(status === 'watched' ? i.key : null);
    setBusy((b) => ({ ...b, [i.key]: true }));
    try {
      let row;
      if (i.season) {
        onUpdated({
          ...t,
          seasons: t.seasons.map((s) =>
            s.season_number === i.season ? { ...s, status, ...(status === 'watched' && { is_downloaded: false }) } : s
          ),
        });
        const result = await setSeasonStatus(t, i.season, status);
        row = result.row;
        if (result.filled.length) showNote(`${t.title}: ${seasonRange(result.filled)} évad is megnézve.`, t.id, result.previous);
      } else {
        const changes = {
          status,
          watched_at: status === 'watched' ? t.watched_at ?? todayDate() : null,
          ...(status === 'watched' && { is_downloaded: false }),
        };
        onUpdated({ ...t, ...changes });
        row = await updateTitle(t.id, changes);
      }
      onUpdated(row);
      if (t.status !== 'watched' && row.status === 'watched' && !row.my_rating) setAsking(i.key);
    } catch (err) {
      onUpdated(t);
      setError(err.message);
    } finally {
      setBusy((b) => ({ ...b, [i.key]: false }));
    }
  }

  async function rate(t, n) {
    setAsking(null);
    try {
      onUpdated(await updateTitle(t.id, { my_rating: n }));
    } catch (err) {
      setError(err.message);
    }
  }

  if (items.length === 0) {
    return <p className="muted wo-empty">Ennek a franchise-nak még nincs címe a listádon.</p>;
  }

  return (
    <div className="watch-order">
      <div className="wo-bar">
        {editing ? (
          <p className="wo-hint">Húzd a tételeket a fogantyúnál, vagy használd a ↑ / ↓ gombokat.</p>
        ) : (
          <p className="wo-summary">
            <b>
              {watched}/{items.length}
            </b>{' '}
            megnézve · {stored ? 'saját sorrend' : 'megjelenés szerint'}
          </p>
        )}
        <span className="spacer" />
        {editing ? (
          <>
            <button type="button" className="ghost" disabled={saving} onClick={byRelease}>
              Megjelenés szerint
            </button>
            <button type="button" className="ghost" disabled={saving} onClick={cancelEdit}>
              Mégse
            </button>
            <button type="button" className="primary" disabled={saving} onClick={finish}>
              {saving ? 'Mentés…' : 'Kész'}
            </button>
          </>
        ) : (
          <>
            {items.length > 1 && (
              <button type="button" className="ghost" onClick={startEdit}>
                Sorrend szerkesztése
              </button>
            )}
            <ShareOrder franchise={franchise} onBusyChange={onShareBusyChange} />
          </>
        )}
      </div>

      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
      <p className="wo-note" role="status">
        {note && (
          <>
            {note.text}{' '}
            <button type="button" className="link" onClick={undoNote}>
              Visszavonás
            </button>
          </>
        )}
      </p>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <ol className="wo-list" ref={listRef} data-editing={editing || undefined}>
        {shown.map((i, index) => {
          const done = itemDone(i);
          const label = itemLabel(i);
          const poster = i.title.poster_path;
          return (
            <li
              key={i.key}
              data-key={i.key}
              data-done={done || undefined}
              data-next={(!editing && next?.key === i.key) || undefined}
              data-status={i.status}
              data-dragging={dragging === i.key || undefined}
              data-strike={struck === i.key || undefined}
            >
              {editing ? (
                <span
                  className="wo-handle"
                  aria-hidden="true"
                  title="Húzd a helyére"
                  onPointerDown={(e) => startDrag(e, i)}
                />
              ) : (
                <input
                  type="checkbox"
                  className="wo-check"
                  checked={done}
                  disabled={!i.aired || busy[i.key]}
                  aria-label={`${label} – megnézve`}
                  title={i.aired ? undefined : 'Még nem jelent meg'}
                  onChange={() => toggle(i)}
                />
              )}
              <span className="wo-num">{index + 1}.</span>
              <span className="thumb">{poster && <img src={THUMB + poster} alt="" loading="lazy" />}</span>
              <span className="wo-text">
                <span className="wo-title">
                  <span className="strike">
                    {i.title.title}
                    {i.season > 0 && <span className="wo-season"> – {i.season}. évad</span>}
                  </span>
                </span>
                <span className="wo-meta">
                  {itemMeta(i)}
                  {done && <span className="sr-only"> · megnézve</span>}
                </span>
              </span>
              <span className="wo-tags">
                {next?.key === i.key && !editing && <span className="wo-tag next">Következik</span>}
                {i.status === DROPPED_STATUS && <span className="wo-tag dropped">Abbahagyva</span>}
                {i.downloaded && !done && <span className="wo-tag dl">Letöltve</span>}
              </span>
              {editing && (
                <span className="wo-move">
                  <button
                    type="button"
                    className="wo-up"
                    aria-label={`Feljebb: ${label}`}
                    disabled={index === 0 || saving}
                    onClick={() => step(i, index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="wo-down"
                    aria-label={`Lejjebb: ${label}`}
                    disabled={index === shown.length - 1 || saving}
                    onClick={() => step(i, index, 1)}
                  >
                    ↓
                  </button>
                </span>
              )}
              {asking === i.key && !editing && (
                <div className="wo-ask">
                  <span>
                    Megnézted: <b>{i.title.title}</b>. Hogy tetszett?
                  </span>
                  <StarRating
                    name={`wo-ask-${i.title.id}`}
                    label={`Értékelés – ${i.title.title}`}
                    value={null}
                    onChange={(n) => rate(i.title, n)}
                  />
                  <button type="button" className="link small" onClick={() => setAsking(null)}>
                    Később
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
