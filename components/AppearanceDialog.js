'use client';

import { useLayoutEffect, useRef } from 'react';
import { useBackdropClose } from '@/lib/useBackdropClose';
import { useSlidingThumb } from '@/lib/useSlidingThumb';
import { PALETTES, setPalette, setTheme, usePalette, useTheme } from '@/lib/theme';
import DialogClose from '@/components/DialogClose';

const THEMES = [
  { id: 'dark', name: 'Sötét' },
  { id: 'light', name: 'Világos' },
  { id: 'teka', name: 'Videotéka' },
];

// „Kinézet” (terv-3 142, a ⋮ menüből – Norbi választása a látványterv után, 2026-10-27,
// https://claude.ai/artifact/R9NdMJkGoaWPKbghm8dvWx): a téma (sötét / világos / videotéka) és a színpár egy helyen;
// mindkettő kattintásra érvényes és mentődik (lib/theme.js), a lap a háttérben rögtön átszíneződik. A tékának saját
// színei vannak: ott a színpár nem választható (a választás megmarad a sötéthez / világoshoz). Kikattintásra mindig
// bezárul (nincs benne bevitel).
export default function AppearanceDialog({ onClose }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const theme = useTheme();
  const palette = usePalette();
  const themeThumb = useSlidingThumb();
  const paletteThumb = useSlidingThumb();
  const closing = { onClose: () => dialogRef.current.close() };
  const backdrop = useBackdropClose(dialogRef, closing);
  const teka = theme === 'teka';

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
  }, []);

  return (
    <dialog ref={dialogRef} className="editor appearance-dialog" aria-labelledby="appearance-title" onClose={onClose} {...backdrop}>
      <DialogClose dialogRef={dialogRef} {...closing} />
      <div className="import-body">
        <h2 id="appearance-title" ref={headingRef} tabIndex={-1}>
          Kinézet
        </h2>

        <section className="appearance-part" aria-labelledby="appearance-theme">
          <h3 id="appearance-theme">Téma</h3>
          <div className="role-switch sliding appearance-themes" ref={themeThumb} role="group" aria-labelledby="appearance-theme">
            {THEMES.map((t) => (
              <button key={t.id} type="button" aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}>
                {t.name}
              </button>
            ))}
          </div>
        </section>

        <section className="appearance-part" aria-labelledby="appearance-palette">
          <h3 id="appearance-palette">Színpár</h3>
          <p className="appearance-hint" id="appearance-palette-hint">
            {teka
              ? 'A videotéka-témának saját színei vannak. A színpár a sötét és a világos témában érvényes.'
              : 'A gombok, a neonfelirat és a saját jelöléseid (csillagok, Mama) színe.'}
          </p>
          <div
            className="palette-pick sliding"
            ref={paletteThumb}
            role="group"
            aria-labelledby="appearance-palette"
            aria-describedby="appearance-palette-hint"
          >
            {PALETTES.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={palette === p.id}
                disabled={teka}
                title={p.description}
                onClick={() => setPalette(p.id)}
              >
                <span className="palette-dots" aria-hidden="true">
                  {p.dots[theme === 'light' ? 'light' : 'dark'].map((c, i) => (
                    <i key={i} style={{ background: c }} />
                  ))}
                </span>
                {p.name}
              </button>
            ))}
          </div>
        </section>
      </div>
    </dialog>
  );
}
