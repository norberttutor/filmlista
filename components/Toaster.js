'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { dismissToast, getToasts, subscribeToasts } from '@/lib/toast';

const NONE = [];

// a sáv fajtája szerinti ikon (terv-3 52.5, Norbi választása: „B”): kuka / csillag
const KIND_ICONS = {
  delete: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3',
  rating: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
};

// Az értesítősávok helye (lib/toast.js): alul középen, telefonon a lebegő „+” fölött.
export default function Toaster() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, () => NONE);
  return (
    <div className="toaster" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast: t }) {
  // rámutatáskor és fókusznál megáll (a csík is), utána a maradék idő fut tovább
  const [paused, setPaused] = useState(false);
  const remaining = useRef(t.duration);

  useEffect(() => {
    if (paused || t.duration == null) return; // duration: null – nem jár le (pl. „Frissült az app”)
    const started = Date.now();
    const timer = setTimeout(() => dismissToast(t.id, 'expire'), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, t.id, t.duration]);

  return (
    <div
      className="toast"
      data-kind={t.kind}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      {KIND_ICONS[t.kind] && (
        <span className="toast-kind" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d={KIND_ICONS[t.kind]} />
          </svg>
        </span>
      )}
      {t.image && <img src={t.image} alt="" />}
      <p className="toast-text">{t.text}</p>
      {t.content}
      {t.action && (
        <button
          type="button"
          className="ghost"
          onClick={() => {
            t.action.onClick();
            dismissToast(t.id, 'action');
          }}
        >
          {t.action.label}
        </button>
      )}
      {!t.hideClose && (
        <button
          type="button"
          className="toast-close"
          aria-label="Értesítés bezárása"
          onClick={() => dismissToast(t.id, 'close')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}
      {t.duration != null && (
        <span
          className="toast-bar"
          aria-hidden="true"
          style={{ animationDuration: `${t.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
        />
      )}
    </div>
  );
}
