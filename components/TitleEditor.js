'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { updateTitle, deleteTitle } from '@/lib/titles';

const RATINGS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

// mai dátum YYYY-MM-DD formában, helyi idő szerint (a svéd formátum pont ilyen)
function today() {
  return new Date().toLocaleDateString('sv-SE');
}

// Felugró ablak egy cím saját adatainak szerkesztésére és törlésére.
// A natív <dialog> elemet használja: Esc-re bezárul, a fókusz az ablakban marad.
export default function TitleEditor({ title: t, statuses, onSaved, onDeleted, onClose }) {
  const dialogRef = useRef(null);
  const deleteButtonRef = useRef(null);
  const [form, setForm] = useState({
    status: t.status,
    is_downloaded: t.is_downloaded,
    my_rating: t.my_rating ? String(t.my_rating) : '',
    notes: t.notes ?? '',
    watched_at: t.watched_at ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    setForm((f) => ({
      ...f,
      status: code,
      // megnézettre állításkor a mai nap az alapértelmezett
      watched_at: code === 'watched' && !f.watched_at ? today() : f.watched_at,
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
        status: form.status,
        is_downloaded: form.is_downloaded,
        my_rating: form.my_rating ? Number(form.my_rating) : null,
        notes: form.notes.trim() || null,
        // a dátumnak csak megnézett címnél van értelme
        watched_at: form.status === 'watched' ? form.watched_at || null : null,
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
          </p>
        </header>

        <fieldset className="field">
          <legend>Állapot</legend>
          <div className="segmented">
            {statuses.map((s) => (
              <label key={s.code}>
                <input
                  type="radio"
                  name="status"
                  checked={form.status === s.code}
                  onChange={() => changeStatus(s.code)}
                />
                <span>{s.name}</span>
              </label>
            ))}
          </div>
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

        <fieldset className="field">
          <legend>Saját értékelés</legend>
          <div className="segmented rating">
            <label>
              <input
                type="radio"
                name="my_rating"
                checked={form.my_rating === ''}
                onChange={() => setField('my_rating', '')}
              />
              <span>Nincs</span>
            </label>
            {RATINGS.map((n) => (
              <label key={n}>
                <input
                  type="radio"
                  name="my_rating"
                  checked={form.my_rating === n}
                  onChange={() => setField('my_rating', n)}
                />
                <span>{n}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="field">
          Megjegyzés
          <textarea
            rows={3}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </label>

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
