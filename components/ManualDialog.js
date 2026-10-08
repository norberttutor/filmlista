'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useBackdropClose } from '@/lib/useBackdropClose';

// a build előtt a scripts/leiras.mjs állítja elő a FELHASZNALOI-LEIRAS.md-ből
const SOURCE = '/leiras/leiras.html';
const TOC_ID = 'leiras-tartalom';

// Felhasználói leírás (terv-3 48, a ⋮ menüből): a FELHASZNALOI-LEIRAS.md formázva, képekkel, az
// appon belüli ablakban (Norbi döntése: nem új lapon). Fent a cím, „Tartalom” (a tartalomjegyzékhez
// görget) és „Bezárás”; alatta a görgethető leírás. A belső hivatkozások (tartalomjegyzék,
// „lásd 9.”) az ablakon belül ugranak, a címet nem változtatják; a külsők új lapon nyílnak.
export default function ManualDialog({ onClose }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const contentRef = useRef(null);
  const [html, setHtml] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // asztalon kikattintásra bezárul (nincs benne bevitel, mindig zárhat)
  const backdrop = useBackdropClose(dialogRef, { onClose: () => dialogRef.current.close() });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(false);
    fetch(SOURCE)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.text();
      })
      .then((text) => !cancelled && setHtml(text))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function jumpTo(id) {
    const target = contentRef.current?.querySelector(`#${CSS.escape(id)}`);
    if (!target) return;
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  }

  function handleClick(e) {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    e.preventDefault();
    jumpTo(decodeURIComponent(link.getAttribute('href').slice(1)));
  }

  return (
    <dialog ref={dialogRef} className="editor manual-dialog" aria-labelledby="manual-title" onClose={onClose} {...backdrop}>
      <header className="manual-head">
        <h2 id="manual-title" ref={headingRef} tabIndex={-1}>
          Felhasználói leírás
        </h2>
        {html && (
          <button type="button" className="ghost" onClick={() => jumpTo(TOC_ID)}>
            Tartalom
          </button>
        )}
        <button type="button" className="ghost" onClick={() => dialogRef.current.close()}>
          Bezárás
        </button>
      </header>
      <div className="manual-scroll">
        {html ? (
          <article
            ref={contentRef}
            className="manual"
            onClick={handleClick}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : error ? (
          <div className="manual-state" role="alert">
            <p>Nem sikerült betölteni a leírást. Ellenőrizd az internetkapcsolatot, és próbáld újra.</p>
            <button type="button" onClick={() => setAttempt((n) => n + 1)}>
              Újrapróbálás
            </button>
          </div>
        ) : (
          <p className="manual-state muted" role="status">
            Leírás betöltése…
          </p>
        )}
      </div>
    </dialog>
  );
}
