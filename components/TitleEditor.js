'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  updateTitle,
  deleteTitle,
  todayDate,
  DEFAULT_STATUS,
  MAMA_OPTIONS,
} from '@/lib/titles';
import StarRating from '@/components/StarRating';
import FranchiseSelect from '@/components/FranchiseSelect';
import ImdbBadge from '@/components/ImdbBadge';
import { hasSeasons, SeasonList, useSeasonActions } from '@/components/Seasons';

// Rádiógombok "chip" formában; a kiválasztottra újra kattintva visszaáll üresre.
function ClearableChips({ name, options, value, onChange }) {
  return (
    <div className="segmented">
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
  onSaved,
  onChanged,
  onDeleted,
  onClose,
}) {
  const dialogRef = useRef(null);
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

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal(); // fejlesztői módban az effect kétszer fut
  }, []);

  // a dialog "close" eseménye hívja az onClose-t (Esc-nél is)
  function close() {
    dialogRef.current.close();
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
      close();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="editor" aria-labelledby="editor-title" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <header>
          <h2 id="editor-title">{t.title}</h2>
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
              {/* az (üres) alapállapotnak nincs gombja: egyik sincs kiválasztva */}
              <ClearableChips
                name="status"
                options={statuses.filter((s) => s.code !== DEFAULT_STATUS)}
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
          <ClearableChips
            name="mama_status"
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
      </form>
    </dialog>
  );
}
