'use client';

// Cím másolása az adatlapról (terv-3 146, Norbi választása: „B”): kis kerek gomb a cím végén, kattintásra a cím a
// vágólapra kerül, a gomb 1,5 mp-re pipára vált, alatta „Másolva” buborék. Telefonon nincs (Norbi kérése – a CSS
// rejti, 30-adatlap-mezok.css). Ha a böngésző nem engedi a vágólapot, a címet kijelöli („Kijelölve – Ctrl+C”).
// A gomb a <h2>-n belül, az utolsó szóval egy töretlen egységben (TitleWithCopy): mindig a szöveg végén áll, egyedül
// nem törik új sorba (hosszú, többsoros címnél a doboz jobb szélén furán állt – Norbi észrevétele). A visszajelzés nem
// változtat a gomb méretén (a buborék ::after, abszolút) – a cím kattintásra nem törik újra. A <h2> szövege (és
// textContent-je) a cím marad: a gombban nincs szöveg, a felolvasónak szóló állapot (CopyTitleStatus) a címen kívül.
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

const LABELS = { ok: 'Másolva', fail: 'Kijelölve – Ctrl+C' };

// text: a másolandó cím; headingRef: a cím eleme (hibánál ezt jelöli ki) → { done: null | 'ok' | 'fail', copy }
export function useCopyTitle(text, headingRef) {
  const [done, setDone] = useState(null);
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
    const failed = () => {
      selectHeading();
      show('fail');
    };
    if (!p) return failed();
    p.then(() => show('ok'), failed);
  }

  return { done, copy };
}

// a cím szövege, a végén a gomb: az utolsó szó és a gomb együtt törik (white-space: nowrap)
export function TitleWithCopy({ title, done, onCopy }) {
  const m = /^([\s\S]*\s)?(\S+)\s*$/.exec(title ?? '');
  if (!m) return title;
  return (
    <>
      {m[1] ?? ''}
      <span className="title-end">
        {m[2]}
        <button
          type="button"
          className="title-copy"
          data-done={done ?? undefined}
          data-label={done ? LABELS[done] : undefined}
          aria-label="Cím másolása"
          title="Cím másolása"
          onClick={onCopy}
        >
          {done === 'ok' ? OK_ICON : COPY_ICON}
        </button>
      </span>
    </>
  );
}

// a felolvasónak: a másolás eredménye (a címen kívül – a cím szövegébe nem kerülhet)
export function CopyTitleStatus({ done }) {
  return (
    <span className="sr-only" role="status">
      {done === 'ok' ? 'A cím a vágólapra került' : done === 'fail' ? 'A cím kijelölve, másold Ctrl+C-vel' : ''}
    </span>
  );
}
