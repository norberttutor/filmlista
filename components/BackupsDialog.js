'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BACKUP_KINDS, createBackup, listBackups, restoreBackup } from '@/lib/backups';
import { useBackdropClose } from '@/lib/useBackdropClose';

const formatWhen = (iso) =>
  new Date(iso).toLocaleString('hu-HU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

// "Mentések" (a fejléc ⋮ menüjéből): a heti automatikus és a kézi mentések listája,
// "Mentés most", és visszaállítás megerősítéssel (előtte a mostaniról is mentés készül).
// onRestored: visszaállítás után a lista újratöltése.
export default function BackupsDialog({ titleCount, onRestored, onClose }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const [backups, setBackups] = useState(null); // null: betöltés alatt
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(null); // 'backup' | 'restore'
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  // asztalon kikattintásra bezárul – mentés / visszaállítás közben és nyitott megerősítésnél nem
  const backdrop = useBackdropClose(dialogRef, {
    onClose: () => dialogRef.current.close(),
    canClose: () => !busy && confirmId == null,
  });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
  }, []);

  async function reload() {
    try {
      setBackups(await listBackups());
    } catch (err) {
      setError(err.message);
      setBackups((b) => b ?? []);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function backupNow() {
    setBusy('backup');
    setError('');
    setStatus('');
    try {
      const id = await createBackup();
      await reload(); // a lista és a felirat egyszerre változzon
      setStatus(id ? `Mentés kész: ${titleCount} cím.` : 'A listád üres, nincs mit menteni.');
    } catch (err) {
      setError(err.message);
    }
    setBusy(null);
  }

  async function restore(b) {
    setBusy('restore');
    setError('');
    setStatus('');
    try {
      const n = await restoreBackup(b.id);
      setConfirmId(null);
      await onRestored();
      await reload();
      setStatus(
        `Visszaállítva: ${n} cím (mentés: ${formatWhen(b.created_at)}). Az előző állapotról mentés készült („Visszaállítás előtt”).`
      );
    } catch (err) {
      setError(err.message);
    }
    setBusy(null);
  }

  return (
    <dialog ref={dialogRef} className="editor backups-dialog" aria-labelledby="backups-title" onClose={onClose} {...backdrop}>
      <div className="import-body">
        <h2 id="backups-title" ref={headingRef} tabIndex={-1}>
          Mentések
        </h2>
        <p className="muted small">
          Hétfőnként hajnalban automatikus mentés készül a listádról, a 8 hétnél régebbiek törlődnek.
          Visszaállításkor előbb a mostani állapotról is mentés készül, így az is visszacsinálható.
        </p>

        {backups === null ? (
          <p className="muted">Mentések betöltése…</p>
        ) : backups.length === 0 ? (
          <p>Még nincs mentés. Az első automatikus mentés hétfő hajnalban készül, vagy ments most.</p>
        ) : (
          <ul className="backup-list" aria-label="Mentések">
            {backups.map((b) =>
              confirmId === b.id ? (
                <li key={b.id} className="backup-confirm">
                  <p>
                    A listád (most {titleCount} cím) helyére ez a mentés kerül:{' '}
                    <b>{formatWhen(b.created_at)}</b>, {b.title_count} cím. Előtte a mostaniról mentés
                    készül.
                  </p>
                  <span className="backup-confirm-actions">
                    <button type="button" className="ghost" autoFocus onClick={() => setConfirmId(null)}>
                      Mégse
                    </button>
                    <button type="button" className="danger" disabled={busy === 'restore'} onClick={() => restore(b)}>
                      {busy === 'restore' ? 'Visszaállítás…' : 'Visszaállítás'}
                    </button>
                  </span>
                </li>
              ) : (
                <li key={b.id}>
                  <span className="backup-when">{formatWhen(b.created_at)}</span>
                  <span className="backup-kind">{BACKUP_KINDS[b.kind] ?? b.kind}</span>
                  <span className="backup-count">{b.title_count} cím</span>
                  <button
                    type="button"
                    className="ghost"
                    disabled={busy !== null}
                    aria-label={`Visszaállítás: ${formatWhen(b.created_at)}, ${b.title_count} cím`}
                    onClick={() => setConfirmId(b.id)}
                  >
                    Visszaállítás
                  </button>
                </li>
              )
            )}
          </ul>
        )}

        {status && <p role="status">{status}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="editor-actions">
          <button type="button" className="ghost" disabled={busy !== null} onClick={backupNow}>
            {busy === 'backup' ? 'Mentés…' : 'Mentés most'}
          </button>
          <span className="spacer" />
          <button type="button" className="primary" onClick={() => dialogRef.current.close()}>
            Bezárás
          </button>
        </div>
      </div>
    </dialog>
  );
}
