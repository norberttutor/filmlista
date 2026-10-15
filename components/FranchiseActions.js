'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api';
import { mapLimit } from '@/lib/bulkImport';
import { releaseKey, setFranchiseLogo } from '@/lib/titles';
import { FranchiseLogo } from '@/components/FranchiseFilter';

const icon = (d) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const ICONS = {
  filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5z',
  rename: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  logo: 'M4 5h16v14H4zM4 15l4-4 5 5M13 13l2-2 5 5M15.5 8.5h.01',
  trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6',
};

// A franchise műveletei ikonos gombokként (Norbi kérése, 2026-10-15 – korábban linkek; mint az adatlap „Törlés a
// listáról” gombja): „Szűrés erre”, „Átnevezés”, „Logó” (átnézés J8 – csak a gyűjtemény-ablakban), „Törlés” (pirosas).
// A Franchise-ok csempéje alatt és a gyűjtemény-ablak fejlécében. A hiányzó kezelőjű gomb elmarad. compact (a
// csempén, ahol egy sorba kell férnie): az „Átnevezés” és a „Törlés” csak ikon – a neve súgóban és felolvasónak
// (name: a franchise neve).
export function FranchiseActions({ className = '', name, compact, onShow, showDisabled, onRename, onLogo, logoOpen, onDelete }) {
  const iconOnly = (label, verb) => (compact ? { 'aria-label': `„${name}” ${verb}`, title: label } : {});
  return (
    <div className={`fr-actions ${className}`.trim()} data-compact={compact ? '' : undefined}>
      {onShow && (
        <button type="button" className="ghost mini fr-action" disabled={showDisabled} onClick={onShow}>
          {icon(ICONS.filter)}
          Szűrés erre
        </button>
      )}
      {onRename && (
        <button type="button" className="ghost mini fr-action" onClick={onRename} {...iconOnly('Átnevezés', 'átnevezése')}>
          {icon(ICONS.rename)}
          {!compact && 'Átnevezés'}
        </button>
      )}
      {onLogo && (
        <button type="button" className="ghost mini fr-action" aria-expanded={logoOpen} onClick={onLogo}>
          {icon(ICONS.logo)}
          Logó
        </button>
      )}
      {onDelete && (
        <button type="button" className="ghost mini fr-action danger-ghost" onClick={onDelete} {...iconOnly('Törlés', 'törlése')}>
          {icon(ICONS.trash)}
          {!compact && 'Törlés'}
        </button>
      )}
    </div>
  );
}

const MAX_TITLES = 12;

// A franchise logójának kézi választása (átnézés J8, 2026-10-15): az automatikus logó a franchise első filmjéé,
// gyakran alcímmel („The Lord of the Rings – The Fellowship of the Ring”). Itt a franchise címeinek (megjelenés
// szerint az első 12) TMDB-logói közül választhat (címenként legfeljebb 4 – /api/tmdb/logos, 3-asával), vagy „Csak a
// név” (logó nélkül – a logo_path ''). A kattintás azonnal ment; a kiválasztott türkiz kerettel. A logók sötét
// alapon, mint a Franchise-ok csempéjén (sötét sziget mindkét témában).
export function FranchiseLogoPicker({ franchise, titles, onPicked, onClose }) {
  const [options, setOptions] = useState(null); // [{ path, title }] – betöltés alatt null
  const [failed, setFailed] = useState(0);
  const [saving, setSaving] = useState(null); // a mentés alatt álló útvonal ('' – csak a név)
  const [error, setError] = useState('');

  const sources = titles
    .filter((t) => t.franchise_id === franchise.id && t.tmdb_id)
    .sort((a, b) => (releaseKey(a) ?? '9999').localeCompare(releaseKey(b) ?? '9999'))
    .slice(0, MAX_TITLES);
  const sourcesKey = sources.map((t) => `${t.media_type}:${t.tmdb_id}`).join(',');

  useEffect(() => {
    const controller = new AbortController();
    const list = sourcesKey ? sourcesKey.split(',').map((k) => k.split(':')) : [];
    const found = new Array(list.length);
    let errors = 0;
    mapLimit(
      list.map(([type, id], i) => ({ type, id, i })),
      3,
      async ({ type, id, i }) => {
        try {
          const { logos } = await apiGet('/api/tmdb/logos', { type, id }, { signal: controller.signal });
          found[i] = logos;
        } catch (err) {
          if (err.name !== 'AbortError') errors++;
        }
      },
      () => {}
    ).then(() => {
      if (controller.signal.aborted) return;
      const seen = new Set();
      const all = [];
      found.forEach((logos, i) => {
        for (const l of logos ?? []) {
          if (seen.has(l.path)) continue;
          seen.add(l.path);
          all.push({ path: l.path, title: sources[i]?.title ?? '' });
        }
      });
      setFailed(errors);
      setOptions(all);
    });
    return () => controller.abort();
    // a források a kulcsukkal változnak (a titles minden mentéskor új tömb)
  }, [sourcesKey]);

  async function pick(path) {
    if (saving != null || path === (franchise.logo_path ?? null)) return;
    setSaving(path);
    setError('');
    try {
      onPicked(await setFranchiseLogo(franchise.id, path));
    } catch (err) {
      setError(err.message);
    }
    setSaving(null);
  }

  const current = franchise.logo_path ?? null;
  // a mostani logó akkor is választható marad, ha a címek logói között nincs (pl. a cím azóta kikerült)
  const shown = options && current && !options.some((o) => o.path === current) ? [{ path: current, title: 'A mostani logó' }, ...options] : options;

  return (
    <section className="logo-picker" aria-labelledby="logo-picker-title">
      <header>
        <h3 id="logo-picker-title">Logó választása</h3>
        <p className="muted small">A franchise címeinek logói a TMDB-ről – kattints arra, amelyik az egész franchise-t jelölje.</p>
        <button type="button" className="ghost mini" onClick={onClose}>
          Kész
        </button>
      </header>
      {shown == null ? (
        <p className="muted small" aria-busy="true">
          Logók betöltése…
        </p>
      ) : (
        <ul className="logo-options">
          <li>
            <button type="button" className="logo-option" aria-pressed={!current} onClick={() => pick('')}>
              <span className="fr-logo">
                <b>{franchise.name}</b>
              </span>
              <span className="logo-caption">Csak a név</span>
            </button>
          </li>
          {shown.map((o) => (
            <li key={o.path}>
              <button
                type="button"
                className="logo-option"
                aria-pressed={current === o.path}
                aria-label={`Logó: ${o.title}`}
               
                onClick={() => pick(o.path)}
              >
                <span className="fr-logo">
                  <FranchiseLogo path={o.path} />
                </span>
                <span className="logo-caption" aria-hidden="true">
                  {saving === o.path ? 'Mentés…' : o.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {shown?.length === 0 && sources.length > 0 && failed === 0 && (
        <p className="muted small">A franchise címeihez nincs logó a TMDB-n.</p>
      )}
      {sources.length === 0 && <p className="muted small">A franchise-nak még nincs címe, amelynek logója lehetne.</p>}
      {failed > 0 && (
        <p className="error small" role="alert">
          {failed} cím logóit nem sikerült betölteni a TMDB-ről. Zárd be, és próbáld újra pár perc múlva.
        </p>
      )}
      {error && (
        <p className="error small" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
