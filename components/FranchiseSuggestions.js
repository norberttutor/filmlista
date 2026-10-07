'use client';

import { useRef, useState } from 'react';
import { assignFranchises, updateTitle } from '@/lib/titles';

const THUMB = 'https://image.tmdb.org/t/p/w92';

// „Javasolt hozzárendelések” a Franchise-ok ablak tetején (terv-3 35): a franchise nélküli filmek,
// amelyek egy franchise-od TMDB-gyűjteményébe tartoznak (lib/franchiseSuggest.js). Pipálható lista
// (alapból mind kipipálva) → „Hozzárendelés (N)”; soronként „Nem kell” – az a film többé nem kerül
// javaslatba (franchise_suggestion_off). Ha nincs javaslat, semmi nem látszik.
// suggestions: [{ title, franchise }]; onUpdated(sor): a friss sor a listába.
export default function FranchiseSuggestions({ suggestions, onUpdated }) {
  const [unchecked, setUnchecked] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const headingRef = useRef(null);

  if (suggestions.length === 0) return null;
  const chosen = suggestions.filter((s) => !unchecked.has(s.title.id));

  function toggle(id) {
    setUnchecked((u) => {
      const next = new Set(u);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function assign() {
    setBusy(true);
    setError('');
    try {
      const rows = await assignFranchises(chosen.map((s) => ({ id: s.title.id, franchise_id: s.franchise.id })));
      rows.forEach(onUpdated);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  async function decline(t) {
    setBusy(true);
    setError('');
    try {
      onUpdated(await updateTitle(t.id, { franchise_suggestion_off: true }));
      headingRef.current?.focus();
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <section className="fr-suggest" aria-labelledby="fr-suggest-title">
      <h3 id="fr-suggest-title" ref={headingRef} tabIndex={-1}>
        Javasolt hozzárendelések <span className="muted">({suggestions.length})</span>
      </h3>
      <p className="muted small">
        Franchise nélküli filmjeid, amelyek egy franchise-od TMDB-gyűjteményébe tartoznak. A kipipáltak kerülnek
        be.
      </p>
      <ul className="fr-suggest-list">
        {suggestions.map(({ title: t, franchise: f }) => (
          <li key={t.id}>
            <label>
              <input type="checkbox" checked={!unchecked.has(t.id)} onChange={() => toggle(t.id)} />
              <span className="thumb">{t.poster_path && <img src={THUMB + t.poster_path} alt="" loading="lazy" />}</span>
              <span className="hidden-text">
                <b>{t.title}</b>
                <span className="muted small">
                  {t.release_year ?? 'Év nélkül'} → <span className="fr-suggest-to">{f.name}</span>
                </span>
              </span>
            </label>
            <button
              type="button"
              className="ghost mini"
              aria-label={`Nem kell: ${t.title} – ${f.name}`}
              disabled={busy}
              onClick={() => decline(t)}
            >
              Nem kell
            </button>
          </li>
        ))}
      </ul>
      <div className="fr-suggest-actions">
        <button type="button" className="primary mini" disabled={busy || chosen.length === 0} onClick={assign}>
          {busy ? 'Mentés…' : `Hozzárendelés (${chosen.length})`}
        </button>
        {error && (
          <p className="error small" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
