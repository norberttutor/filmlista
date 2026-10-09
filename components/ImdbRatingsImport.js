'use client';

import { useImperativeHandle, useRef, useState } from 'react';
import { parseImdbExport, planRatingImport, planWatchlistImport } from '@/lib/imdbImport';
import { mapLimit } from '@/lib/bulkImport';
import { apiGet } from '@/lib/api';
import { addTitle, applyMyRatings, titleKey } from '@/lib/titles';

const stars = (n) => (n == null ? '–' : `${n}`);
const THUMB_BASE = 'https://image.tmdb.org/t/p/w92';

// "IMDb import" (a fejléc ⋮ menüjéből: ref.current.open() – fájlválasztó). Az IMDb két
// exportját ismeri fel (lib/imdbImport.js):
// - értékelések: a listán lévő címek saját csillagát frissíti (előtte összefoglaló);
// - figyelőlista (watchlist): a listán még nem szereplő címeket a TMDB-n keresi (IMDb-azonosító
//   alapján), kipipálható listában mutatja, és felveszi őket (Megnézendő állapotban).
// A fájl nem kerül fel sehova.
export default function ImdbRatingsImport({ titles, onApplied, onAdded, ref }) {
  const inputRef = useRef(null);
  useImperativeHandle(ref, () => ({ open: () => inputRef.current.click() }), []);
  const dialogRef = useRef(null);
  // { plan } (értékelések) | { watch } (figyelőlista) | { error } | { done }
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState(false);
  // a futás azonosítója: bezáráskor és új fájlnál változik – a háttérben tovább futó régi keresés /
  // felvétel már nem nyúl az ablakhoz (különben bezárás után null állapotot olvasna, és az app
  // összeomlana; kódaudit #7). A felvétel ettől még végigfut, a címek felkerülnek.
  const runRef = useRef(0);
  const updater = (run) => (fn) => setView((v) => (runRef.current === run && v?.watch ? fn(v) : v));

  function show(next) {
    setView(next);
    if (!dialogRef.current.open) dialogRef.current.showModal();
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // ugyanaz a fájl később újra kiválasztható legyen
    if (!file) return;
    runRef.current++;
    let parsed;
    try {
      parsed = parseImdbExport(await file.text());
    } catch (err) {
      show({ error: err.message });
      return;
    }
    if (parsed.kind === 'ratings') {
      show({ plan: planRatingImport(titles, parsed.ratings) });
      return;
    }
    await searchWatchlist(planWatchlistImport(titles, parsed.items));
  }

  // a figyelőlista listán nem szereplő címei a TMDB-n (3-asával); a TMDB-azonosító szerint már
  // listán lévők (IMDb-azonosító nélkül felvettek) is kimaradnak
  async function searchWatchlist(plan) {
    const watch = { inFile: plan.inFile, onList: plan.onList, phase: 'searching', progress: { done: 0, total: plan.missing.length }, rows: [], notFound: [] };
    show({ watch });
    if (plan.missing.length === 0) {
      setView({ watch: { ...watch, phase: 'review' } });
      return;
    }
    const update = updater(runRef.current);
    const keys = new Set(titles.map(titleKey));
    const found = await mapLimit(
      plan.missing,
      3,
      async (item) => {
        try {
          const { result } = await apiGet('/api/tmdb/find', { imdb: item.imdbId });
          return { item, result };
        } catch (err) {
          return { item, result: null, error: err.message };
        }
      },
      (done) => update((v) => ({ watch: { ...v.watch, progress: { ...v.watch.progress, done } } }))
    );
    const rows = [];
    const notFound = [];
    let onList = plan.onList;
    const seen = new Set();
    for (const { item, result } of found) {
      if (!result) notFound.push(item);
      else if (keys.has(titleKey(result)) || seen.has(titleKey(result))) onList++;
      else {
        seen.add(titleKey(result));
        rows.push({ ...result, key: titleKey(result), checked: true });
      }
    }
    update(() => ({ watch: { ...watch, onList, phase: 'review', rows, notFound } }));
  }

  const setRowChecked = (key, checked) =>
    setView((v) => ({ watch: { ...v.watch, rows: v.watch.rows.map((r) => (r.key === key ? { ...r, checked } : r)) } }));

  async function addChosen() {
    const chosen = view.watch.rows.filter((r) => r.checked);
    const update = updater(runRef.current);
    update((v) => ({ watch: { ...v.watch, phase: 'adding', progress: { done: 0, total: chosen.length } } }));
    const failed = [];
    let added = 0;
    await mapLimit(
      chosen,
      2,
      async (r) => {
        try {
          onAdded(await addTitle({ media_type: r.media_type, tmdb_id: r.tmdb_id }));
          added++;
        } catch (err) {
          failed.push({ title: r.title, message: err.message });
        }
      },
      (done) => update((v) => ({ watch: { ...v.watch, progress: { ...v.watch.progress, done } } }))
    );
    update((v) => ({ watch: { ...v.watch, phase: 'done', added, failed } }));
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
  const watch = view?.watch;
  const chosenCount = watch?.rows.filter((r) => r.checked).length ?? 0;
  const close = () => dialogRef.current.close();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        aria-label="IMDb-export CSV-fájlja"
        onChange={handleFile}
      />

      <dialog
        ref={dialogRef}
        className="editor import-dialog bulk-dialog"
        aria-labelledby="imdb-import-title"
        onClose={() => {
          runRef.current++;
          setView(null);
        }}
        onCancel={(e) => watch?.phase === 'adding' && e.preventDefault()} // felvétel közben ne záródjon
      >
        <div className="import-body">
          <h2 id="imdb-import-title">{watch ? 'IMDb-figyelőlista betöltése' : 'IMDb-értékelések betöltése'}</h2>

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

          {watch && (
            <>
              {(watch.phase === 'searching' || watch.phase === 'adding') && (
                <div className="bulk-progress" role="status">
                  <span>
                    {watch.phase === 'searching' ? 'Keresés a TMDB-n' : 'Felvétel a listára'}: {watch.progress.done}{' '}
                    / {watch.progress.total}
                  </span>
                  <progress value={watch.progress.done} max={watch.progress.total || 1} />
                </div>
              )}

              {watch.phase !== 'searching' && (
                <p className="watch-summary">
                  A fájlban <b>{watch.inFile}</b> cím van: <b>{watch.onList}</b> már a listádon,{' '}
                  <b>{watch.rows.length}</b> új
                  {watch.notFound.length > 0 && <>, {watch.notFound.length} nincs meg a TMDB-n</>}.
                </p>
              )}

              {watch.phase === 'review' && watch.rows.length > 0 && (
                <>
                  <p className="muted small">Megnézendőként kerülnek a listára; amelyiket nem kéred, vedd ki a pipát.</p>
                  <ul className="bulk-rows watch-rows" aria-label="Új címek">
                    {watch.rows.map((r) => (
                      <li key={r.key} className="bulk-row">
                        <label className="bulk-cand">
                          <input type="checkbox" checked={r.checked} onChange={(e) => setRowChecked(r.key, e.target.checked)} />
                          <span className="bulk-thumb">
                            {r.poster_path && <img src={THUMB_BASE + r.poster_path} alt="" loading="lazy" />}
                          </span>
                          <span className="bulk-info">
                            <b>{r.title}</b>
                            <span>
                              {[r.release_year, r.media_type === 'tv' ? 'Sorozat' : 'Film', r.original_title !== r.title && r.original_title]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {watch.phase !== 'searching' && watch.notFound.length > 0 && (
                <p className="muted small">
                  A TMDB-n nem találtam (nem kerülnek fel): {watch.notFound.map((i) => i.title).join(', ')}
                </p>
              )}

              {watch.phase === 'done' && (
                <>
                  <p role="status">Kész: {watch.added} cím felkerült a listára.</p>
                  {watch.failed.length > 0 && (
                    <ul className="error" role="alert">
                      {watch.failed.map((f, i) => (
                        <li key={i}>
                          Nem sikerült: {f.title} – {f.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
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
                <button type="button" className="ghost" onClick={close}>
                  Mégse
                </button>
                <button type="button" className="primary" disabled={busy} onClick={apply}>
                  {busy ? 'Beírás…' : 'Értékelések beírása'}
                </button>
              </>
            ) : watch && (watch.phase === 'review' || watch.phase === 'searching') && (watch.phase === 'searching' || watch.rows.length > 0) ? (
              <>
                <button type="button" className="ghost" onClick={close}>
                  Mégse
                </button>
                <button type="button" className="primary" disabled={watch.phase !== 'review' || chosenCount === 0} onClick={addChosen}>
                  {chosenCount} cím felvétele
                </button>
              </>
            ) : (
              <button type="button" className="primary" disabled={watch?.phase === 'adding'} onClick={close}>
                Bezárás
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
