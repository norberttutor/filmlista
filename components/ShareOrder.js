'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createShare, loadShare, revokeShare, shareUrl } from '@/lib/shares';

// „Megosztás” a nézési sorrend sávjában (terv-3 41): a gomb alatt kinyíló panel – link nélkül
// „Link létrehozása”, utána a link (kijelölhető mező), „Link másolása”, telefonon „Küldés…” (a
// rendszer megosztója), „Megnyitás” (új lapon) és „Megosztás visszavonása” megerősítéssel. A link
// csak olvasható: belépés nélkül, borítókkal, a megnézett állapot nélkül (app/sorrend/[token]).
// onBusyChange: a megerősítés és a kérések alatt a gyűjtemény-ablak ne záródjon kikattintásra.
export default function ShareOrder({ franchise, onBusyChange }) {
  const [token, setToken] = useState(undefined); // undefined: még tölt, null: nincs link
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const copiedTimer = useRef(null);
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  useEffect(() => {
    let alive = true;
    loadShare(franchise.id)
      .then((t) => alive && setToken(t))
      .catch(() => alive && setToken(null));
    return () => {
      alive = false;
      clearTimeout(copiedTimer.current);
    };
  }, [franchise.id]);

  // layout-effektben: a jelzés még a következő kattintás előtt beáll (a sima effekt csak a
  // kirajzolás után futna – egy gyors kikattintás addig bezárná az ablakot); eltűnéskor elengedi
  useLayoutEffect(() => {
    onBusyChange?.(busy || confirming);
  }, [busy, confirming, onBusyChange]);
  useEffect(() => () => onBusyChange?.(false), [onBusyChange]);

  const url = token ? shareUrl(token) : '';

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const create = () => run(async () => setToken(await createShare(franchise.id)));

  const revoke = () =>
    run(async () => {
      await revokeShare(franchise.id);
      setToken(null);
      setConfirming(false);
    });

  async function copy() {
    setError('');
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      inputRef.current?.select();
      setError('Nem sikerült a vágólapra másolni. A link ki van jelölve: másold ki a Ctrl+C-vel.');
    }
  }

  function send() {
    navigator.share({ title: `${franchise.name} – nézési sorrend`, url }).catch(() => {});
  }

  return (
    <>
      <button
        type="button"
        className="ghost wo-share-btn"
        aria-expanded={open}
        aria-controls="wo-share-panel"
        data-shared={token ? '' : undefined}
        onClick={() => {
          setOpen((o) => !o);
          setConfirming(false);
          setError('');
        }}
      >
        Megosztás
        {token && <span className="sr-only"> (a link él)</span>}
      </button>

      {open && (
        <div className="wo-share" id="wo-share-panel" role="group" aria-label="A nézési sorrend megosztása">
          {token === undefined ? (
            <p className="muted small">Betöltés…</p>
          ) : token === null ? (
            <>
              <p className="wo-share-text">
                Csak olvasható link a nézési sorrendhez: bárki megnyithatja, akinek elküldöd, belépés nélkül. A címek, az évadok
                és a borítók látszanak, a megnézett állapot és az értékeléseid nem.
              </p>
              <div className="wo-share-actions">
                <button type="button" className="ghost" disabled={busy} onClick={create}>
                  {busy ? 'Létrehozás…' : 'Link létrehozása'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="wo-share-text">
                Aki megkapja ezt a linket, belépés nélkül láthatja a nézési sorrendet (a megnézett állapot nélkül). A sorrend
                változásai a linken is megjelennek.
              </p>
              <input
                ref={inputRef}
                className="wo-share-url"
                type="text"
                readOnly
                value={url}
                aria-label="A megosztott link"
                onFocus={(e) => e.target.select()}
              />
              {confirming ? (
                <div className="wo-share-confirm" role="alert">
                  <span>Visszavonod a linket? Aki megkapta, többé nem tudja megnyitni.</span>
                  <button type="button" className="ghost" disabled={busy} onClick={() => setConfirming(false)}>
                    Mégse
                  </button>
                  <button type="button" className="danger mini" disabled={busy} onClick={revoke}>
                    {busy ? 'Visszavonás…' : 'Visszavonás'}
                  </button>
                </div>
              ) : (
                <div className="wo-share-actions">
                  <button type="button" className="ghost" onClick={copy}>
                    {copied ? '✓ Másolva' : 'Link másolása'}
                  </button>
                  {canShare && (
                    <button type="button" className="ghost" onClick={send}>
                      Küldés…
                    </button>
                  )}
                  <a className="ghost wo-share-open" href={url} target="_blank" rel="noopener noreferrer">
                    Megnyitás
                  </a>
                  <span className="spacer" />
                  <button type="button" className="danger-link small" onClick={() => setConfirming(true)}>
                    Megosztás visszavonása
                  </button>
                </div>
              )}
            </>
          )}
          {error && (
            <p className="error small" role="alert">
              {error}
            </p>
          )}
        </div>
      )}
    </>
  );
}
