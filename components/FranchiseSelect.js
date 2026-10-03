'use client';

import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const NEW = '__new';
const DELETE = '__delete';
const RENAME = '__rename';

// Franchise-választó: üres (alapértelmezett), a meglévők, "+ Új franchise…" (helyben
// névmegadás; Enter: hozzáadás, Esc: mégse), a kiválasztott franchise átnevezése (ugyanígy,
// a régi névvel kitöltve) és törlése megerősítéssel (hibásan felvett kategóriához; minden
// címről lekerül).
export default function FranchiseSelect({
  value,
  franchises,
  onChange,
  onCreate,
  onDelete,
  onRename,
  label,
  className,
}) {
  const [mode, setMode] = useState(''); // '' | 'create' | 'rename' | 'delete'
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectRef = useRef(null);
  const current = franchises.find((f) => f.id === value);

  // vissza a lenyílóhoz, és a fókusz is oda kerül
  function finish() {
    flushSync(() => {
      setMode('');
      setName('');
      setError('');
    });
    selectRef.current?.focus();
  }

  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      finish();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Adj meg egy nevet.');
      return;
    }
    run(async () => {
      const franchise = await onCreate(trimmed);
      onChange(franchise.id);
    });
  }

  function rename() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Adj meg egy nevet.');
      return;
    }
    if (trimmed === current.name) {
      finish();
      return;
    }
    run(() => onRename(current.id, trimmed));
  }

  function remove() {
    run(async () => {
      await onDelete(current.id);
      onChange(null);
    });
  }

  function handleKey(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (mode === 'rename') rename();
      else create();
    } else if (event.key === 'Escape') {
      event.preventDefault(); // a szerkesztő ablak se záródjon be
      finish();
    }
  }

  const errorText = error && (
    <p className="error small" role="alert">
      {error}
    </p>
  );

  if (mode === 'create') {
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
        {errorText}
      </div>
    );
  }

  if (mode === 'rename' && current) {
    return (
      <div className="franchise-new">
        <input
          type="text"
          autoFocus
          aria-label={`„${current.name}” új neve`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKey}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="primary mini" disabled={busy} onClick={rename}>
          Mentés
        </button>
        <button type="button" className="ghost mini" onClick={finish}>
          Mégse
        </button>
        {errorText}
      </div>
    );
  }

  if (mode === 'delete' && current) {
    return (
      <div className="franchise-new">
        <span className="confirm-text">
          Törlöd ezt a franchise-t: „{current.name}”? Minden címről lekerül.
        </span>
        <button type="button" className="ghost mini" autoFocus onClick={finish}>
          Mégse
        </button>
        <button type="button" className="danger mini" disabled={busy} onClick={remove}>
          Igen, törlés
        </button>
        {errorText}
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
        if (v === NEW) setMode('create');
        else if (v === DELETE) setMode('delete');
        else if (v === RENAME) {
          setName(current.name);
          setMode('rename');
        }
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
      {current && onRename && <option value={RENAME}>✎ „{current.name}” átnevezése…</option>}
      {current && onDelete && <option value={DELETE}>× „{current.name}” törlése…</option>}
    </select>
  );
}
