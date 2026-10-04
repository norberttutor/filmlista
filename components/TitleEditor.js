'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  updateTitle,
  deleteTitle,
  todayDate,
  DEFAULT_STATUS,
  DROPPED_STATUS,
  MAMA_OPTIONS,
} from '@/lib/titles';
import StarRating from '@/components/StarRating';
import FranchiseSelect from '@/components/FranchiseSelect';
import ImdbBadge from '@/components/ImdbBadge';
import { hasSeasons, SeasonList, useSeasonActions } from '@/components/Seasons';
import SimilarTitles from '@/components/SimilarTitles';
import { usePosterColor, ambientProps } from '@/lib/posterColor';
import { canMorph, MORPH_NAME } from '@/lib/viewTransition';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w500'; // a nagy borító (asztalon)
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/'; // a háttérkép (telefonon w780, asztalon w1280)
const PHONE_QUERY = '(max-width: 640px)';

// Rádiógombok "chip" formában; a kiválasztottra újra kattintva visszaáll üresre.
function ClearableChips({ name, options, value, onChange, className }) {
  return (
    <div className={className ? `segmented ${className}` : 'segmented'}>
      {options.map((o) => (
        <label key={o.code}>
          <input
            type="radio"
            name={name}
            checked={value === o.code}
            onChange={() => onChange(o.code)}
            onClick={() => value === o.code && onChange(null)}
          />
          <span>{o.name}</span>
        </label>
      ))}
    </div>
  );
}

// Felugró ablak egy cím saját adatainak szerkesztésére és törlésére.
// A natív <dialog> elemet használja: Esc-re bezárul, a fókusz az ablakban marad.
// Sorozatnál az állapot és a "Letöltve" helyett az évadlista látszik; az évadok változása
// azonnal mentődik (onChanged), a többi mező a "Mentés" gombbal.
export default function TitleEditor({
  title: t,
  statuses,
  franchises,
  onCreateFranchise,
  onDeleteFranchise,
  onRenameFranchise,
  existingKeys,
  onAdded,
  onSaved,
  onChanged,
  onDeleted,
  onClose,
  morphTo, // a borító, amelyről nyílt: bezáráskor oda siklik vissza (nézetváltás)
}) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const drag = useRef(null); // telefonon a lehúzás: { y, t, dy }
  const deleteButtonRef = useRef(null);
  const [form, setForm] = useState({
    status: t.status,
    is_downloaded: t.is_downloaded,
    mama_status: t.mama_status ?? null,
    franchise_id: t.franchise_id ?? null,
    my_rating: t.my_rating ?? null,
    watched_at: t.watched_at ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const seasonal = hasSeasons(t);
  const seasonActions = useSeasonActions(t, onChanged, setError);
  // a borító hangulatszíne: az ablak a film színében dereng (globals.css, "Hangulatszín")
  const ambient = usePosterColor(t.poster_path);

  // rajzolás előtt nyílik meg (a nézetváltás új képén már ott legyen az ablak)
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal(); // fejlesztői módban az effect kétszer fut
    // a böngésző az első mezőre (Franchise) tenné a fókuszt, és a kerete feleslegesen
    // világítana: helyette az ablak címe kapja (billentyűzettel a Tab innen a Franchise-ra visz)
    headingRef.current?.focus();
  }, []);

  // a dialog "close" eseménye hívja az onClose-t (Esc-nél is). Asztalon a nagy borító
  // visszasiklik a kártya / sor borítójára (nézetváltás), ha az még a helyén van.
  function close() {
    const dialog = dialogRef.current;
    if (!canMorph(morphTo)) {
      dialog.close();
      return;
    }
    const transition = document.startViewTransition(() => {
      morphTo.style.viewTransitionName = MORPH_NAME;
      dialog.close();
    });
    transition.finished
      .catch(() => {})
      .finally(() => {
        morphTo.style.viewTransitionName = '';
      });
  }

  // telefonon az ablak alsó lap: a fogantyút lefelé húzva bezárul (elég messzire vagy gyorsan),
  // különben visszaugrik
  function dragStart(e) {
    if (!window.matchMedia(PHONE_QUERY).matches) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    dialogRef.current.style.transition = 'none';
  }

  function dragMove(e) {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    dialogRef.current.style.translate = `0 ${drag.current.dy}px`;
  }

  function dragEnd() {
    if (!drag.current) return;
    const { dy, t } = drag.current;
    drag.current = null;
    const dialog = dialogRef.current;
    dialog.style.transition = '';
    const fast = dy / (performance.now() - t) > 0.6; // px/ms
    if (dy > 110 || (fast && dy > 30)) {
      dialog.style.translate = '0 100%';
      setTimeout(close, 180);
    } else {
      dialog.style.translate = '';
    }
  }

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function changeStatus(code) {
    code ??= DEFAULT_STATUS; // a kiválasztott újra kattintva: vissza az (üres) alapállapotba
    setForm((f) => ({
      ...f,
      status: code,
      // megnézettre állításkor a mai nap az alapértelmezett
      watched_at: code === 'watched' && !f.watched_at ? todayDate() : f.watched_at,
      // ...és a "Letöltve" törlődik (az adatbázis-trigger szabálya, itt azonnal látszik)
      is_downloaded: code === 'watched' && f.status !== 'watched' ? false : f.is_downloaded,
    }));
  }

  function cancelDelete() {
    flushSync(() => setConfirmingDelete(false));
    deleteButtonRef.current.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const row = await updateTitle(t.id, {
        // sorozatnál az állapotot, a "Letöltve" jelzőt és a dátumot az évadokból számolja
        // az adatbázis
        ...(!seasonal && {
          status: form.status,
          is_downloaded: form.is_downloaded,
          // a dátumnak csak megnézett címnél van értelme
          watched_at: form.status === 'watched' ? form.watched_at || null : null,
        }),
        mama_status: form.mama_status,
        franchise_id: form.franchise_id,
        my_rating: form.my_rating,
      });
      onSaved(row);
      close();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    setError('');
    try {
      await deleteTitle(t.id);
      onDeleted(t.id);
      dialogRef.current.close(); // a cím eltűnik a listáról: nincs hova visszasiklani
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className={t.backdrop_path ? 'editor title-editor has-backdrop' : 'editor title-editor'}
      aria-labelledby="editor-title"
      onClose={onClose}
      onCancel={(e) => {
        // Esc: a saját bezárás (nézetváltással), nem a böngésző azonnali bezárása
        e.preventDefault();
        close();
      }}
      {...ambientProps(ambient)}
    >
      {/* telefonon: fogantyú – lefelé húzva bezárja az ablakot (a Mégse / Esc ugyanaz) */}
      <div
        className="sheet-handle"
        aria-hidden="true"
        onPointerDown={dragStart}
        onPointerMove={dragMove}
        onPointerUp={dragEnd}
        onPointerCancel={dragEnd}
      />
      {/* a film széles jelenetképe az ablak tetején (TMDB) */}
      {t.backdrop_path && (
        <div className="editor-backdrop" aria-hidden="true">
          <img
            src={BACKDROP_BASE + 'w1280' + t.backdrop_path}
            srcSet={`${BACKDROP_BASE}w780${t.backdrop_path} 780w, ${BACKDROP_BASE}w1280${t.backdrop_path} 1280w`}
            sizes="(max-width: 640px) 100vw, 60rem"
            alt=""
          />
        </div>
      )}
      <form onSubmit={handleSubmit}>
        {/* asztalon a borító nagyban, balra (görgetéskor a helyén marad); telefonon rejtve */}
        <div className="editor-poster" aria-hidden="true">
          {t.poster_path && <img src={POSTER_BASE + t.poster_path} alt="" />}
        </div>
        <div className="editor-main">
          <header>
            <h2 id="editor-title" ref={headingRef} tabIndex={-1}>
              {t.title}
            </h2>
            <p className="meta">
              {t.release_year && <span>{t.release_year}</span>}
              <span>{t.media_type === 'tv' ? 'Sorozat' : 'Film'}</span>
              <ImdbBadge title={t} />
            </p>
            {t.overview && <p className="editor-overview">{t.overview}</p>}
          </header>

          <div className="field">
            <span aria-hidden="true">Franchise</span>
            <FranchiseSelect
              label="Franchise"
              value={form.franchise_id}
              franchises={franchises}
              onChange={(id) => setField('franchise_id', id)}
              onCreate={onCreateFranchise}
              onDelete={onDeleteFranchise}
              onRename={onRenameFranchise}
            />
          </div>

          {seasonal ? (
            <fieldset className="field">
              <legend>Évadok</legend>
              <p className="muted small season-hint">Az évadok változása azonnal mentődik.</p>
              <SeasonList title={t} actions={seasonActions} />
            </fieldset>
          ) : (
            <>
              <fieldset className="field">
                <legend>Állapot</legend>
                {/* az (üres) alapállapotnak nincs gombja: egyik sincs kiválasztva; az
                    "Abbahagyva" csak sorozatnál */}
                <ClearableChips
                  name="status"
                  options={statuses.filter(
                    (s) =>
                      s.code !== DEFAULT_STATUS &&
                      (s.code !== DROPPED_STATUS || t.media_type === 'tv' || t.status === s.code)
                  )}
                  value={form.status}
                  onChange={changeStatus}
                />
              </fieldset>

              {form.status === 'watched' && (
                <label className="field">
                  Megnézve
                  <input
                    type="date"
                    value={form.watched_at}
                    onChange={(e) => setField('watched_at', e.target.value)}
                  />
                </label>
              )}

              <label className="check">
                <input
                  type="checkbox"
                  checked={form.is_downloaded}
                  onChange={(e) => setField('is_downloaded', e.target.checked)}
                />
                Letöltve
              </label>
            </>
          )}

          <fieldset className="field">
            <legend>Mama</legend>
            {/* saját jelölés: kiválasztva a második kiemelőszínnel (borostyán) */}
            <ClearableChips
              name="mama_status"
              className="mama-chips"
              options={MAMA_OPTIONS}
              value={form.mama_status}
              onChange={(code) => setField('mama_status', code)}
            />
          </fieldset>

          <div className="field">
            <span>Saját értékelés</span>
            <div className="rating-field">
              <StarRating
                name="editor-rating"
                label="Saját értékelés"
                value={form.my_rating}
                onChange={(n) => setField('my_rating', n)}
              />
              <span className="rating-number">
                {form.my_rating ? `${form.my_rating}/10` : 'Nincs'}
              </span>
              {form.my_rating && (
                <button
                  type="button"
                  className="link small"
                  onClick={() => setField('my_rating', null)}
                >
                  Törlés
                </button>
              )}
            </div>
          </div>

          {/* a TMDB ajánlásai: egy kattintással a listára */}
          <SimilarTitles title={t} existingKeys={existingKeys} onAdded={onAdded} />

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div className="editor-actions">
            {confirmingDelete ? (
              <>
                <span className="confirm-text">Biztosan törlöd a listádról?</span>
                <span className="spacer" />
                <button type="button" className="ghost" autoFocus onClick={cancelDelete}>
                  Mégse
                </button>
                <button type="button" className="danger" disabled={busy} onClick={handleDelete}>
                  {busy ? 'Törlés…' : 'Igen, törlés'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="danger-link"
                  ref={deleteButtonRef}
                  disabled={busy}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Törlés a listáról
                </button>
                <span className="spacer" />
                <button type="button" className="ghost" onClick={close}>
                  Mégse
                </button>
                <button type="submit" className="primary" disabled={busy}>
                  {busy ? 'Mentés…' : 'Mentés'}
                </button>
              </>
            )}
          </div>
        </div>
      </form>
    </dialog>
  );
}
