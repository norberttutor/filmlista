'use client';

import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const NEW = '__new';

// Franchise-választó: üres (alapértelmezett), a meglévők, vagy "+ Új franchise…",
// amire helyben megadható az új név (Enter: hozzáadás, Esc: mégse).
export default function FranchiseSelect({ value, franchises, onChange, onCreate, label, className }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectRef = useRef(null);

  // vissza a lenyílóhoz, és a fókusz is oda kerül
  function finish() {
    flushSync(() => {
      setCreating(false);
      setName('');
      setError('');
    });
    selectRef.current?.focus();
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Adj meg egy nevet.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const franchise = await onCreate(trimmed);
      onChange(franchise.id);
      finish();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  function handleKey(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      create();
    } else if (event.key === 'Escape') {
      event.preventDefault(); // a szerkesztő ablak se záródjon be
      finish();
    }
  }

  if (creating) {
    return (
      <div className="franchise-new">
        <input
          type="text"
          autoFocus
          aria-label="Új franchise neve"
          placeholder="Új franchise neve"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKey}
        />
        <button type="button" className="primary mini" disabled={busy} onClick={create}>
          Hozzáadás
        </button>
        <button type="button" className="ghost mini" onClick={finish}>
          Mégse
        </button>
        {error && (
          <p className="error small" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <select
      ref={selectRef}
      className={className}
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        if (v === NEW) setCreating(true);
        else onChange(v ? Number(v) : null);
      }}
    >
      <option value=""></option>
      {franchises.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
      <option value={NEW}>+ Új franchise…</option>
    </select>
  );
}
