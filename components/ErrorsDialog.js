'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ERROR_KINDS, deleteErrors, listErrors, markErrorsSeen } from '@/lib/errorLog';
import { useBackdropClose } from '@/lib/useBackdropClose';

const formatWhen = (iso) =>
  new Date(iso).toLocaleString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

// a böngésző és a rendszer röviden a user agentből (pl. „Chrome · Android”)
function browserOf(ua = '') {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Safari\//.test(ua)
          ? 'Safari'
          : 'Böngésző';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : '';
  return [browser, os].filter(Boolean).join(' · ');
}

// a hiba szövegesen – a „Másolás” ezt teszi a vágólapra (Claude-nak beilleszthető)
function asText(e, mama) {
  const lines = [
    `${ERROR_KINDS[e.kind] ?? e.kind}${mama ? ' (Mamánál)' : ''} – ${e.count}×, utoljára ${formatWhen(e.last_at)}` +
      (e.count > 1 ? `, először ${formatWhen(e.first_at)}` : ''),
    `Üzenet: ${e.message}`,
    `Hol: ${e.url ?? '–'} · verzió: ${e.app_version ?? '–'} · ${browserOf(e.user_agent)}`,
  ];
  if (e.stack) lines.push('Verem:', e.stack);
  return lines.join('\n');
}

// ⋮ „Hibák (N)” (terv-3 113): a hibanapló – a böngészőben történt hibák, a Mamánál történtek is („Mamánál”),
// a legutóbb előfordult elöl. Megnyitáskor a látott olvasatlanok olvasottak lesznek („Új” jelzés marad az
// ablak bezárásáig). Soronként „Másolás” (a teljes leírás a vágólapra – Claude-nak beilleszthető) és törlés;
// alul „Összes másolása” és „Összes törlése” (helyben megerősítve). Kikattintásra bezárul – a törlés
// megerősítése és a törlés közben nem. userId: a saját azonosító (ami nem az, az Mamánál történt).
// onChanged: a menüpont számának frissítése (olvasás / törlés után).
export default function ErrorsDialog({ userId, onClose, onChanged }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const [errors, setErrors] = useState(null); // null: betöltés alatt
  const [fresh, setFresh] = useState(() => new Set()); // a megnyitáskor olvasatlanok
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null); // a vágólapra tett sor id-je, vagy 'all'
  const backdrop = useBackdropClose(dialogRef, {
    onClose: () => dialogRef.current.close(),
    canClose: () => !busy && !confirmAll,
  });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
  }, []);

  async function load() {
    setLoadError('');
    try {
      const data = await listErrors();
      const unseen = data.filter((e) => !e.seen_at).map((e) => e.id);
      setFresh(new Set(unseen));
      setErrors(data);
      await markErrorsSeen(unseen);
      onChanged();
    } catch (err) {
      setLoadError(err.message);
      setErrors((e) => e ?? []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(ids) {
    setBusy(true);
    setActionError('');
    try {
      await deleteErrors(ids);
      setErrors((list) => list.filter((e) => !ids.includes(e.id)));
      setConfirmAll(false);
      onChanged();
    } catch (err) {
      setActionError(err.message);
    }
    setBusy(false);
  }

  async function copy(text, id) {
    setActionError('');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    } catch {
      setActionError('Nem sikerült a vágólapra tenni. Jelöld ki a szöveget a „Részletek” alatt, és másold kézzel.');
    }
  }

  const mama = (e) => e.user_id !== userId;

  return (
    <dialog
      ref={dialogRef}
      className="editor errors-dialog"
      aria-labelledby="errors-title"
      onClose={onClose}
      // a megerősítésből az Esc csak a megerősítést zárja; törlés közben nem zár
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else if (confirmAll) {
          e.preventDefault();
          setConfirmAll(false);
        }
      }}
      {...backdrop}
    >
      <div className="import-body">
        <h2 id="errors-title" ref={headingRef} tabIndex={-1}>
          Hibák
        </h2>
        <p className="muted small">
          Ami a böngészőben elromlott (nálad vagy Mamánál). Az ismétlődő hiba egy sorban, darabszámmal; a 30 napja
          nem ismétlődöttek maguktól törlődnek. A „Másolás” a teljes leírást a vágólapra teszi – így
          továbbküldheted Claude-nak.
        </p>

        {errors === null ? (
          <p className="muted">Hibanapló betöltése…</p>
        ) : errors.length === 0 ? (
          !loadError && <p>Nincs naplózott hiba.</p>
        ) : (
          <ul className="error-list" aria-label="Naplózott hibák">
            {errors.map((e) => (
              <li key={e.id} data-kind={e.kind} data-fresh={fresh.has(e.id) ? '' : undefined}>
                <div className="error-head">
                  <span className="error-kind">{ERROR_KINDS[e.kind] ?? e.kind}</span>
                  {fresh.has(e.id) && <span className="error-new">Új</span>}
                  {mama(e) && <span className="error-who">Mamánál</span>}
                  <span className="error-when">
                    {e.count > 1 && <b>{e.count}× · </b>}
                    {formatWhen(e.last_at)}
                  </span>
                </div>
                <p className="error-message">{e.message}</p>
                <details className="error-details">
                  <summary>Részletek</summary>
                  <dl>
                    {e.count > 1 && (
                      <>
                        <dt>Először</dt>
                        <dd>{formatWhen(e.first_at)}</dd>
                      </>
                    )}
                    <dt>Hol</dt>
                    <dd>{e.url ?? '–'}</dd>
                    <dt>Verzió</dt>
                    <dd>{e.app_version ?? '–'}</dd>
                    <dt>Böngésző</dt>
                    <dd title={e.user_agent ?? ''}>{browserOf(e.user_agent)}</dd>
                  </dl>
                  {e.stack && <pre className="error-stack">{e.stack}</pre>}
                </details>
                <div className="error-actions">
                  <button type="button" className="ghost mini" onClick={() => copy(asText(e, mama(e)), e.id)}>
                    {copied === e.id ? 'Másolva' : 'Másolás'}
                  </button>
                  <button
                    type="button"
                    className="ghost mini"
                    disabled={busy}
                    aria-label={`Törlés: ${e.message}`}
                    onClick={() => remove([e.id])}
                  >
                    Törlés
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {loadError && (
          <div className="person-error">
            <p className="error" role="alert">
              {loadError}
            </p>
            <button type="button" className="ghost mini" onClick={load}>
              Újrapróbálás
            </button>
          </div>
        )}
        {actionError && (
          <p className="error" role="alert">
            {actionError}
          </p>
        )}

        {confirmAll ? (
          <div className="backup-list error-confirm">
            <p>Mind a(z) {errors.length} hiba törlődik a naplóból. Ez nem vonható vissza.</p>
            <span className="backup-confirm-actions">
              <button type="button" className="ghost" autoFocus disabled={busy} onClick={() => setConfirmAll(false)}>
                Mégse
              </button>
              <button type="button" className="danger" disabled={busy} onClick={() => remove(errors.map((e) => e.id))}>
                {busy ? 'Törlés…' : 'Összes törlése'}
              </button>
            </span>
          </div>
        ) : (
          <div className="editor-actions">
            {errors?.length > 0 && (
              <>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => copy(errors.map((e) => asText(e, mama(e))).join('\n\n---\n\n'), 'all')}
                >
                  {copied === 'all' ? 'Másolva' : 'Összes másolása'}
                </button>
                <button type="button" className="ghost danger-ghost" disabled={busy} onClick={() => setConfirmAll(true)}>
                  Összes törlése
                </button>
              </>
            )}
            <span className="spacer" />
            <button type="button" className="ghost" disabled={busy} onClick={() => dialogRef.current.close()}>
              Bezárás
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
