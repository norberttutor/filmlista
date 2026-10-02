'use client';

import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  updateTitle,
  deleteTitle,
  externalLink,
  formatDate,
  todayDate,
  DEFAULT_STATUS,
  MAMA_OPTIONS,
} from '@/lib/titles';
import StarRating from '@/components/StarRating';
import FranchiseSelect from '@/components/FranchiseSelect';
import ImdbBadge from '@/components/ImdbBadge';

const THUMB_BASE = 'https://image.tmdb.org/t/p/w154';

// Asztali nézet: egy cím soronként, a saját adatok közvetlenül a sorban szerkeszthetők.
export default function TitleTable({
  titles,
  statuses,
  franchises,
  onCreateFranchise,
  onDeleteFranchise,
  onUpdated,
  onDeleted,
}) {
  return (
    <div className="table-wrap">
      <table className="titles-table">
        <thead>
          <tr>
            <th scope="col">Cím</th>
            <th scope="col" className="col-check">
              Letöltve
            </th>
            <th scope="col" className="col-status">
              Állapot
            </th>
            <th scope="col" className="col-mama">
              Mama
            </th>
            <th scope="col" className="col-rating">
              Értékelés
            </th>
            <th scope="col" className="col-notes">
              <span className="sr-only">Megjegyzés</span>
            </th>
            <th scope="col" className="col-actions">
              <span className="sr-only">Törlés</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {titles.map((t) => (
            <TitleRow
              key={t.id}
              title={t}
              statuses={statuses}
              franchises={franchises}
              onCreateFranchise={onCreateFranchise}
              onDeleteFranchise={onDeleteFranchise}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TitleRow({
  title: t,
  statuses,
  franchises,
  onCreateFranchise,
  onDeleteFranchise,
  onUpdated,
  onDeleted,
}) {
  const [notes, setNotes] = useState(t.notes ?? '');
  const [saveState, setSaveState] = useState(''); // '' | 'saving' | 'saved'
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const savedTimer = useRef(null);
  const deleteButtonRef = useRef(null);
  const link = externalLink(t);

  // Mentés azonnal: a sor rögtön az új értéket mutatja, hiba esetén visszaáll.
  async function save(changes) {
    const before = t;
    const status = changes.status ?? t.status;
    onUpdated({
      ...t,
      ...changes,
      status_name: statuses.find((s) => s.code === status)?.name ?? t.status_name,
    });
    setError('');
    setSaveState('saving');
    clearTimeout(savedTimer.current);
    try {
      onUpdated(await updateTitle(t.id, changes));
      setSaveState('saved');
      savedTimer.current = setTimeout(() => setSaveState(''), 2000);
    } catch (err) {
      onUpdated(before);
      setSaveState('');
      setError(err.message);
    }
  }

  function changeStatus(code) {
    const becomesWatched = code === 'watched' && t.status !== 'watched';
    save({
      status: code,
      // ugyanúgy, mint a szerkesztő ablakban: megnézettnél a mai nap, ha még nincs dátum
      watched_at: code === 'watched' ? t.watched_at ?? todayDate() : null,
      // megnézettre állításkor a "Letöltve" törlődik (az adatbázis-trigger is ezt teszi,
      // itt azért küldjük, hogy a pipa azonnal eltűnjön)
      ...(becomesWatched && { is_downloaded: false }),
    });
  }

  function saveNotes() {
    const value = notes.trim();
    setNotes(value);
    if (value !== (t.notes ?? '')) save({ notes: value || null });
  }

  // Esc: visszavonás mentés nélkül. A fókusz a mezőben marad – ha itt blur()-t
  // hívnánk, a kikattintásos mentés még a régi (eldobandó) szöveggel futna le.
  function handleNotesKey(event) {
    if (event.key === 'Escape') setNotes(t.notes ?? '');
  }

  function cancelDelete() {
    flushSync(() => setConfirmingDelete(false));
    deleteButtonRef.current.focus();
  }

  async function handleDelete() {
    setDeleting(true);
    setError('');
    try {
      await deleteTitle(t.id);
      onDeleted(t.id);
    } catch (err) {
      setError(err.message);
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <tr data-status={t.status}>
      <td className="cell-title">
        <div className="row-title">
          <div className="thumb">
            {t.poster_path && <img src={THUMB_BASE + t.poster_path} alt="" loading="lazy" />}
          </div>
          <div className="row-text">
            <div className="row-head">
              <p className="row-name">
                {link ? (
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {t.title}
                  </a>
                ) : (
                  t.title
                )}
              </p>
              {/* a cím mellett; üresen csak rámutatáskor látszik, hogy ne zsúfolja a listát */}
              <div className={t.franchise_id ? 'franchise-field' : 'franchise-field empty'}>
                {!t.franchise_id && <span aria-hidden="true">Franchise</span>}
                <FranchiseSelect
                  className="franchise-select"
                  label={`Franchise – ${t.title}`}
                  value={t.franchise_id}
                  franchises={franchises}
                  onChange={(id) => save({ franchise_id: id })}
                  onCreate={onCreateFranchise}
                  onDelete={onDeleteFranchise}
                />
              </div>
            </div>
            {t.original_title && t.original_title !== t.title && (
              <p className="original">{t.original_title}</p>
            )}
            <p className="meta">
              {t.release_year && <span>{t.release_year}</span>}
              <span>{t.media_type === 'tv' ? 'Sorozat' : 'Film'}</span>
              <ImdbBadge title={t} />
              {t.genres?.length > 0 && <span>{t.genres.join(', ')}</span>}
            </p>
            <p className="added">
              Hozzáadva: <time dateTime={t.created_at}>{formatDate(t.created_at)}</time>
            </p>
            {error && (
              <p className="error small" role="alert">
                {error}
              </p>
            )}
          </div>
          {/* leírás: széles képernyőn a cím mellett, keskenyebben alatta (CSS); a teljes
              szöveg rámutatáskor látszik */}
          {t.overview && (
            <p className="row-overview" title={t.overview}>
              {t.overview}
            </p>
          )}
        </div>
      </td>

      {confirmingDelete ? (
        <td colSpan={6} className="cell-confirm">
          <span className="confirm-text">Biztosan törlöd a listádról?</span>
          <button type="button" className="ghost" autoFocus onClick={cancelDelete}>
            Mégse
          </button>
          <button type="button" className="danger" disabled={deleting} onClick={handleDelete}>
            {deleting ? 'Törlés…' : 'Igen, törlés'}
          </button>
        </td>
      ) : (
        <>
          <td className="col-check">
            <input
              type="checkbox"
              aria-label={`Letöltve – ${t.title}`}
              checked={t.is_downloaded}
              onChange={(e) => save({ is_downloaded: e.target.checked })}
            />
          </td>
          <td className="col-status">
            <select
              aria-label={`Állapot – ${t.title}`}
              value={t.status}
              onChange={(e) => changeStatus(e.target.value)}
            >
              {statuses.map((s) => (
                <option key={s.code} value={s.code}>
                  {/* az alapállapot üresen jelenik meg */}
                  {s.code === DEFAULT_STATUS ? '' : s.name}
                </option>
              ))}
            </select>
          </td>
          <td className="col-mama">
            <select
              aria-label={`Mama – ${t.title}`}
              value={t.mama_status ?? ''}
              onChange={(e) => save({ mama_status: e.target.value || null })}
            >
              <option value=""></option>
              {MAMA_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          </td>
          <td className="col-rating">
            <div className="rating-field">
              <StarRating
                name={`rating-${t.id}`}
                label={`Értékelés – ${t.title}`}
                value={t.my_rating}
                onChange={(n) => save({ my_rating: n })}
              />
              <span className="rating-number">{t.my_rating ? `${t.my_rating}/10` : ''}</span>
            </div>
          </td>
          <td className="col-notes">
            <div className="notes-field">
              <textarea
                className="notes-input"
                rows={2}
                placeholder="Megjegyzés…"
                aria-label={`Megjegyzés – ${t.title}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={saveNotes}
                onKeyDown={handleNotesKey}
              />
              <p className="save-state" aria-live="polite">
                {saveState === 'saving' ? 'Mentés…' : saveState === 'saved' ? 'Mentve' : ''}
              </p>
            </div>
          </td>
          <td className="col-actions">
            <button
              type="button"
              className="icon-btn"
              ref={deleteButtonRef}
              aria-label={`Törlés – ${t.title}`}
              onClick={() => setConfirmingDelete(true)}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          </td>
        </>
      )}
    </tr>
  );
}
