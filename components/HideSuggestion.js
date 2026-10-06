'use client';

import { useEffect, useRef, useState } from 'react';
import { hideSuggestion, unhideSuggestion } from '@/lib/hiddenSuggestions';

// „Nem érdekel” (×) az ajánlások borítóján (terv-3 39) – a Felfedezés és a Hasonló címek közös
// része: useHideSuggestion() → { hide, note }, <HideButton>, <HideNote>. A visszavonás helyben,
// a szakasz tetején jelenik meg (a szerkesztő ablakban az értesítősáv nem kattintható), 10 mp-ig.
export function useHideSuggestion() {
  const [note, setNote] = useState(null); // { item } | { error }
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  function show(next) {
    clearTimeout(timer.current);
    setNote(next);
    timer.current = setTimeout(() => setNote(null), 10000);
  }

  async function hide(r) {
    show({ item: r });
    try {
      await hideSuggestion(r);
    } catch (err) {
      show({ error: err.message });
    }
  }

  async function undo() {
    const r = note?.item;
    if (!r) return;
    clearTimeout(timer.current);
    setNote(null);
    try {
      await unhideSuggestion(r);
    } catch (err) {
      show({ error: err.message });
    }
  }

  return { note, hide, undo };
}

export function HideButton({ item, onHide }) {
  return (
    <button
      type="button"
      className="hide-btn"
      aria-label={`Nem érdekel: ${item.title}`}
      title="Nem érdekel – többé nem ajánlja"
      onClick={() => onHide(item)}
    >
      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
        <path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function HideNote({ note, onUndo }) {
  return (
    <p className="hide-note" role="status">
      {note?.item && (
        <>
          „{note.item.title}” elrejtve – többé nem ajánljuk.{' '}
          <button type="button" className="link" onClick={onUndo}>
            Visszavonás
          </button>
        </>
      )}
      {note?.error && <span className="error">{note.error}</span>}
    </p>
  );
}
