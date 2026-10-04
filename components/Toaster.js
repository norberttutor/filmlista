'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { dismissToast, getToasts, subscribeToasts } from '@/lib/toast';

const NONE = [];

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
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(() => dismissToast(t.id, 'expire'), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, t.id]);

  return (
    <div
      className="toast"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
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
      <span
        className="toast-bar"
        aria-hidden="true"
        style={{ animationDuration: `${t.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
      />
    </div>
  );
}
