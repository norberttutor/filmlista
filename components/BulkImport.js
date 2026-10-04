'use client';

import { useImperativeHandle, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { addTitle } from '@/lib/titles';
import { MAX_LINES, matchEntry, parseLines } from '@/lib/bulkImport';

const THUMB_BASE = 'https://image.tmdb.org/t/p/w92';
const PARALLEL = 3; // egyszerre ennyi TMDB-kérés

const TAGS = {
  sure: 'Biztos',
  unsure: 'Válassz',
  onList: 'Már a listán',
  none: 'Nincs találat',
  error: 'Hiba',
};

// items feldolgozása legfeljebb `limit` párhuzamos kéréssel; onProgress(kész darab)
async function mapLimit(items, limit, fn, onProgress) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
      onProgress(++done);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function Candidate({ c, name, checked, onPick }) {
  return (
    <label className="bulk-cand" data-on-list={c.onList ? '' : undefined}>
      <input type="radio" name={name} checked={checked} disabled={c.onList} onChange={onPick} />
      <span className="bulk-thumb">
        {c.poster_path && <img src={THUMB_BASE + c.poster_path} alt="" loading="lazy" />}
      </span>
      <span className="bulk-info">
        <b>{c.title}</b>
        <span>
          {[c.release_year, c.media_type === 'tv' ? 'Sorozat' : 'Film', c.onList && '✓ A listán']
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
    </label>
  );
}

// "Tömeges import" (asztali nézetben): soronként beillesztett címek keresése a TMDB-n, a
// biztos találatok előre kijelölve, a bizonytalanoknál Norbi választ, a listán lévők
// kimaradnak; utána egyenként felveszi őket (mint a "Hozzáadás a listához").
// A fejléc ⋮ menüjéből nyílik: ref.current.open()
export default function BulkImport({ existingKeys, onAdded, ref }) {
  const dialogRef = useRef(null);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState('input'); // input | searching | review | adding | done
  const [rows, setRows] = useState([]); // [{ line, query, year, status, candidates, choice, open }]
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { added, failed: [{ line, message }] }

  function openDialog() {
    setPhase('input');
    setError('');
    setResult(null);
    dialogRef.current.showModal();
  }
  useImperativeHandle(ref, () => ({ open: openDialog }));

  async function search() {
    const entries = parseLines(text);
    if (entries.length === 0) {
      setError('Írj be legalább egy címet (soronként egyet).');
      return;
    }
    if (entries.length > MAX_LINES) {
      setError(`Egyszerre legfeljebb ${MAX_LINES} címet tudok feldolgozni – oszd több részre.`);
      return;
    }
    setError('');
    setPhase('searching');
    setProgress({ done: 0, total: entries.length });
    const found = await mapLimit(
      entries,
      PARALLEL,
      async (entry) => {
        try {
          const { results } = await apiGet('/api/tmdb/search', { q: entry.query });
          const match = matchEntry(entry, results, existingKeys);
          return { ...entry, ...match, open: match.status === 'unsure' };
        } catch (err) {
          return { ...entry, status: 'error', message: err.message, candidates: [], choice: null };
        }
      },
      (done) => setProgress((p) => ({ ...p, done }))
    );
    setRows(found);
    setPhase('review');
  }

  const setRow = (i, changes) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...changes } : r)));

  // a kiválasztottak, egy cím csak egyszer (ha két sor ugyanazt választotta)
  const chosen = [];
  const chosenKeys = new Set();
  for (const r of rows) {
    if (!r.choice || chosenKeys.has(r.choice)) continue;
    chosenKeys.add(r.choice);
    chosen.push({ row: r, candidate: r.candidates.find((c) => c.key === r.choice) });
  }
  const count = (status) => rows.filter((r) => r.status === status).length;

  async function addAll() {
    setPhase('adding');
    setProgress({ done: 0, total: chosen.length });
    const failed = [];
    let added = 0;
    await mapLimit(
      chosen,
      2,
      async ({ row, candidate }) => {
        try {
          onAdded(await addTitle({ media_type: candidate.media_type, tmdb_id: candidate.tmdb_id }));
          added++;
        } catch (err) {
          failed.push({ line: row.line, message: err.message });
        }
      },
      (done) => setProgress((p) => ({ ...p, done }))
    );
    setResult({ added, failed });
    // a sikertelenek maradnak a szövegmezőben (újrapróbálhatók), a többi kikerül
    setText(failed.map((f) => f.line).join('\n'));
    setPhase('done');
  }

  return (
    <>
      <dialog
        ref={dialogRef}
        className="editor import-dialog bulk-dialog"
        aria-labelledby="bulk-title"
        onCancel={(e) => phase === 'adding' && e.preventDefault()} // felvétel közben ne záródjon
      >
        <div className="import-body">
          <h2 id="bulk-title">Tömeges import</h2>

          {phase === 'input' && (
            <>
              <label className="field">
                Címek, soronként egy (a sor végén évszám is lehet)
                <textarea
                  rows={12}
                  value={text}
                  autoFocus
                  placeholder={'Dűne 2021\nCsillagok között\nA sötét lovag (2008)'}
                  onChange={(e) => setText(e.target.value)}
                />
              </label>
              <p className="muted small">
                Legfeljebb {MAX_LINES} cím egyszerre. Előbb mindet megkeresem a TMDB-n, és csak a
                jóváhagyásod után veszem fel őket.
              </p>
            </>
          )}

          {(phase === 'searching' || phase === 'adding') && (
            <div className="bulk-progress" role="status">
              <p>
                {phase === 'searching' ? 'Keresés a TMDB-n' : 'Felvétel a listára'}: {progress.done}{' '}
                / {progress.total}
              </p>
              <progress value={progress.done} max={progress.total} />
            </div>
          )}

          {phase === 'review' && (
            <>
              <p>
                <b>{rows.length}</b> cím: {count('sure')} biztos, {count('unsure')} bizonytalan
                (válassz), {count('onList')} már a listán, {count('none') + count('error')} nincs
                találat.
              </p>
              <ul className="bulk-rows" aria-label="Találatok">
                {rows.map((r, i) => {
                  const picked = r.candidates.find((c) => c.key === r.choice);
                  return (
                    <li key={r.line} className="bulk-row" data-status={r.status}>
                      <div className="bulk-line">
                        <span className="bulk-text">{r.line}</span>
                        <span className="bulk-tag">{TAGS[r.status]}</span>
                        {r.status === 'onList' && (
                          <span className="muted small">
                            {r.candidates.find((c) => c.key === r.match)?.title}
                          </span>
                        )}
                        {r.status === 'error' && <span className="error small">{r.message}</span>}
                        {(r.status === 'sure' || r.status === 'unsure') && !r.open && (
                          <button
                            type="button"
                            className="link small"
                            onClick={() => setRow(i, { open: true })}
                          >
                            Másik találat
                          </button>
                        )}
                      </div>
                      {(r.status === 'sure' || r.status === 'unsure') &&
                        (r.open ? (
                          <div className="bulk-cands" role="radiogroup" aria-label={`Találat: ${r.line}`}>
                            {r.candidates.map((c) => (
                              <Candidate
                                key={c.key}
                                c={c}
                                name={`bulk-${i}`}
                                checked={r.choice === c.key}
                                onPick={() => setRow(i, { choice: c.key })}
                              />
                            ))}
                            <label className="bulk-cand bulk-skip">
                              <input
                                type="radio"
                                name={`bulk-${i}`}
                                checked={r.choice == null}
                                onChange={() => setRow(i, { choice: null })}
                              />
                              <span>Kihagyás</span>
                            </label>
                          </div>
                        ) : (
                          picked && (
                            <div className="bulk-cands">
                              <span className="bulk-cand" data-picked="">
                                <span className="bulk-thumb">
                                  {picked.poster_path && (
                                    <img src={THUMB_BASE + picked.poster_path} alt="" loading="lazy" />
                                  )}
                                </span>
                                <span className="bulk-info">
                                  <b>{picked.title}</b>
                                  <span>
                                    {[picked.release_year, picked.media_type === 'tv' ? 'Sorozat' : 'Film']
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                </span>
                              </span>
                            </div>
                          )
                        ))}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {phase === 'done' && result && (
            <div role="status" className="bulk-done">
              <p>
                Kész: <b>{result.added}</b> cím felkerült a listára.
              </p>
              {result.failed.length > 0 && (
                <ul className="import-summary">
                  {result.failed.map((f) => (
                    <li key={f.line} className="error">
                      {f.line}: {f.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}

          <div className="editor-actions">
            {phase === 'review' && (
              <button type="button" className="ghost" onClick={() => setPhase('input')}>
                Vissza a szerkesztéshez
              </button>
            )}
            <span className="spacer" />
            {phase === 'done' ? (
              <button type="button" className="primary" onClick={() => dialogRef.current.close()}>
                Bezárás
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="ghost"
                  disabled={phase === 'adding'}
                  onClick={() => dialogRef.current.close()}
                >
                  Mégse
                </button>
                {phase === 'input' && (
                  <button type="button" className="primary" disabled={!text.trim()} onClick={search}>
                    Keresés
                  </button>
                )}
                {phase === 'review' && (
                  <button
                    type="button"
                    className="primary"
                    disabled={chosen.length === 0}
                    onClick={addAll}
                  >
                    {chosen.length} cím felvétele
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
