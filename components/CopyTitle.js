'use client';

// Cím másolása az adatlapról (terv-3 146, Norbi választása: „B”): kis kerek gomb a cím mellett, kattintásra a cím a
// vágólapra kerül, a gomb 1,5 mp-re pipára vált („Másolva”). Telefonon nincs (Norbi kérése – a CSS rejti,
// 30-adatlap-mezok.css). Ha a böngésző nem engedi a vágólapot, a címet kijelöli, és a gomb Ctrl+C-t javasol.
import { useEffect, useRef, useState } from 'react';

const COPY_ICON = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
    <path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
  </svg>
);

const OK_ICON = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

// text: a másolandó cím; headingRef: a cím eleme (hibánál ezt jelöli ki)
export default function CopyTitle({ text, headingRef }) {
  const [done, setDone] = useState(null); // null | 'ok' | 'fail'
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);
  // másik címre váltva (a lap tartalma cserélődik) a visszajelzés nem marad rajta
  useEffect(() => {
    clearTimeout(timer.current);
    setDone(null);
  }, [text]);

  function show(result) {
    clearTimeout(timer.current);
    setDone(result);
    timer.current = setTimeout(() => setDone(null), result === 'ok' ? 1500 : 3000);
  }

  function selectHeading() {
    const el = headingRef.current;
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function copy() {
    // a writeText a kattintás kezelőjében indul (különben a böngésző megtagadhatja)
    const p = navigator.clipboard?.writeText(text);
    if (!p) {
      selectHeading();
      show('fail');
      return;
    }
    p.then(
      () => show('ok'),
      () => {
        selectHeading();
        show('fail');
      }
    );
  }

  return (
    <>
      <button
        type="button"
        className="title-copy"
        data-done={done ?? undefined}
        aria-label="Cím másolása"
        title="Cím másolása"
        onClick={copy}
      >
        {done === 'ok' ? OK_ICON : COPY_ICON}
        {done && <span className="title-copy-label">{done === 'ok' ? 'Másolva' : 'Kijelölve – Ctrl+C'}</span>}
      </button>
      <span className="sr-only" role="status">
        {done === 'ok' ? 'A cím a vágólapra került' : done === 'fail' ? 'A cím kijelölve, másold Ctrl+C-vel' : ''}
      </span>
    </>
  );
}
