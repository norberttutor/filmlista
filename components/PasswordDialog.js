'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useBackdropClose } from '@/lib/useBackdropClose';

const MIN_LENGTH = 8;

// a jelenlegi jelszó ellenőrzése egy külön, semmit nem tároló klienssel: így a bejelentkezett
// munkamenet (és a token) nem cserélődik, és a lap nem kap „SIGNED_IN” eseményt
async function checkPassword(email, password) {
  const probe = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'filmlista-jelszo-ellenorzes' },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (!error) await probe.auth.signOut({ scope: 'local' }); // az ellenőrző munkamenet ne maradjon élve
  return !error;
}

// a Supabase hibái magyarul (a kódjuk szerint)
function updateMessage(error) {
  switch (error.code) {
    case 'same_password':
      return 'Az új jelszó ugyanaz, mint a mostani. Adj meg egy másikat.';
    case 'weak_password':
      return 'Az új jelszó túl gyenge. Adj meg hosszabbat, betűkkel és számokkal.';
    case 'reauthentication_needed':
      return 'A jelszócseréhez a Supabase most e-mailes megerősítést kér, ezt az app nem tudja kezelni. Szólj Claude-nak.';
    default:
      return `Nem sikerült menteni az új jelszót (${error.message}). Ellenőrizd az internetkapcsolatot, és próbáld újra.`;
  }
}

// „Jelszó módosítása” (terv-3 27, a fejléc e-mail-címéről és a ⋮ menüből): jelenlegi jelszó, új
// jelszó kétszer → előbb ellenőrző belépés a jelenlegivel, utána `updateUser`. Elfelejtett jelszó
// nincs (Norbi döntése, 2026-10-08).
export default function PasswordDialog({ email, onClose }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  // asztalon kikattintásra bezárul – de ha már gépelt valamit, vagy mentés közben, nem (a beírt
  // jelszavak ne vesszenek el egy félrekattintástól); az Esc és a Mégse mindig zár
  const backdrop = useBackdropClose(dialogRef, {
    onClose: () => dialogRef.current.close(),
    canClose: () => !busy && (done || !(current || next || again)),
  });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (next.length < MIN_LENGTH) return setError(`Az új jelszó legalább ${MIN_LENGTH} karakter legyen.`);
    if (next !== again) return setError('A két új jelszó nem egyezik. Írd be újra mindkettőt.');
    if (next === current) return setError('Az új jelszó ugyanaz, mint a mostani. Adj meg egy másikat.');
    setBusy(true);
    try {
      if (!(await checkPassword(email, current))) {
        setError('A jelenlegi jelszó nem jó. Írd be újra.');
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        setError(updateMessage(error));
        return;
      }
      setCurrent('');
      setNext('');
      setAgain('');
      setDone(true);
    } catch {
      setError('Nem sikerült menteni az új jelszót. Ellenőrizd az internetkapcsolatot, és próbáld újra.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialogRef} className="editor password-dialog" aria-labelledby="password-title" onClose={onClose} {...backdrop}>
      <form className="import-body" onSubmit={handleSubmit}>
        <h2 id="password-title" ref={headingRef} tabIndex={-1}>
          Jelszó módosítása
        </h2>
        {done ? (
          <p role="status" className="password-done">
            A jelszavad megváltozott. Legközelebb már az újjal lépj be.
          </p>
        ) : (
          <>
            <p className="muted small">
              {email} · az új jelszó legalább {MIN_LENGTH} karakter legyen.
            </p>
            {/* a böngésző jelszókezelője ebből tudja, melyik fiókhoz menti az új jelszót */}
            <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
            <label>
              Jelenlegi jelszó
              <input
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label>
              Új jelszó
              <input
                type="password"
                autoComplete="new-password"
                required
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </label>
            <label>
              Új jelszó még egyszer
              <input
                type="password"
                autoComplete="new-password"
                required
                value={again}
                onChange={(e) => setAgain(e.target.value)}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </>
        )}

        <div className="editor-actions">
          <span className="spacer" />
          {done ? (
            <button type="button" className="primary" onClick={() => dialogRef.current.close()}>
              Bezárás
            </button>
          ) : (
            <>
              <button type="button" className="ghost" onClick={() => dialogRef.current.close()}>
                Mégse
              </button>
              <button type="submit" className="primary" disabled={busy}>
                {busy ? 'Mentés…' : 'Jelszó mentése'}
              </button>
            </>
          )}
        </div>
      </form>
    </dialog>
  );
}
