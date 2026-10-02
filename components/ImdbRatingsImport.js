'use client';

import { useRef, useState } from 'react';
import { parseImdbRatings, planRatingImport } from '@/lib/imdbImport';
import { applyMyRatings } from '@/lib/titles';

const stars = (n) => (n == null ? '–' : `${n}`);

// Visszafogott "IMDb-értékelések betöltése" gomb: az IMDb exportált CSV-jéből a listán lévő
// címek saját csillagát frissíti (előtte összefoglalót mutat). A fájl nem kerül fel sehova.
export default function ImdbRatingsImport({ titles, onApplied }) {
  const inputRef = useRef(null);
  const dialogRef = useRef(null);
  const [view, setView] = useState(null); // { plan } | { error } | { done }
  const [busy, setBusy] = useState(false);

  function show(next) {
    setView(next);
    if (!dialogRef.current.open) dialogRef.current.showModal();
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // ugyanaz a fájl később újra kiválasztható legyen
    if (!file) return;
    try {
      show({ plan: planRatingImport(titles, parseImdbRatings(await file.text())) });
    } catch (err) {
      show({ error: err.message });
    }
  }

  async function apply() {
    setBusy(true);
    try {
      await applyMyRatings(view.plan.changes);
      onApplied(view.plan.changes);
      setView({ done: view.plan.changes.length });
    } catch (err) {
      setView({ ...view, error: err.message });
    }
    setBusy(false);
  }

  const plan = view?.plan;

  return (
    <>
      <button type="button" className="subtle-link" onClick={() => inputRef.current.click()}>
        IMDb-értékelések betöltése
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        aria-label="IMDb-értékelések CSV-fájlja"
        onChange={handleFile}
      />

      <dialog
        ref={dialogRef}
        className="editor import-dialog"
        aria-labelledby="imdb-import-title"
        onClose={() => setView(null)}
      >
        <div className="import-body">
          <h2 id="imdb-import-title">IMDb-értékelések betöltése</h2>

          {plan && (
            <>
              <p>
                A fájlban <b>{plan.inFile}</b> értékelés van, ebből <b>{plan.onList}</b> film
                szerepel a listádon.
              </p>
              <ul className="import-summary">
                <li>
                  <b>{plan.changes.length}</b> cím csillaga változik ({plan.added} új,{' '}
                  {plan.overwritten} felülírt)
                </li>
                <li>{plan.same} már egyezik</li>
                <li>{plan.notOnList} film nincs a listádon – ezeket nem veszem fel</li>
              </ul>
              <p className="muted small">Az állapotokat (pl. „Megnézve”) nem módosítom.</p>

              {plan.changes.length > 0 && (
                <ul className="import-changes" aria-label="Változások">
                  {plan.changes.map((c) => (
                    <li key={c.id}>
                      <span>
                        {c.title}
                        {c.year && <span className="muted"> ({c.year})</span>}
                      </span>
                      <span className="import-arrow">
                        ★ {stars(c.from)} → <b>{stars(c.to)}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {view?.done != null && (
            <p role="status">Kész: {view.done} cím értékelése frissült.</p>
          )}

          {view?.error && (
            <p className="error" role="alert">
              {view.error}
            </p>
          )}

          <div className="editor-actions">
            <span className="spacer" />
            {plan && view?.done == null && plan.changes.length > 0 ? (
              <>
                <button type="button" className="ghost" onClick={() => dialogRef.current.close()}>
                  Mégse
                </button>
                <button type="button" className="primary" disabled={busy} onClick={apply}>
                  {busy ? 'Beírás…' : 'Értékelések beírása'}
                </button>
              </>
            ) : (
              <button type="button" className="primary" onClick={() => dialogRef.current.close()}>
                Bezárás
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
