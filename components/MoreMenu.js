'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { popupSide } from '@/lib/popupSide';

// A menüpontok ikonjai (vonalas, mint a többi ikon)
const ICONS = {
  star: <path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95z" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  list: <path d="M8 6h13M8 12h13M8 18h8M3 6h.01M3 12h.01M3 18h.01M19 15v6M16 18h6" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  // óra visszafelé mutató nyíllal (mentések, visszaállítás)
  history: <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6M3 3.5V8h4.5M12 7.5V12l3 2" />,
};

// "További műveletek" (⋮) gomb a fejlécben, mint a Chrome menüje: kattintásra vagy
// billentyűzettel (Enter, Szóköz, nyilak) lenyíló lista. A menüben: nyilak / Home / End
// között lép, Enter választ, Esc / Tab / kívülre kattintás bezár (Esc után a fókusz a gombra).
// items: [{ id, label, description, icon, onSelect }]
export default function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState('right'); // a lista a gomb melyik széléhez igazodik
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);
  const menuId = useId();

  // kívülre kattintva bezárul
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function focusItem(i) {
    const n = items.length;
    itemRefs.current[(i + n) % n]?.focus();
  }

  function openMenu(first = 0) {
    setSide(popupSide(buttonRef.current, 336, 'right'));
    setOpen(true);
    // a lista a következő rajzolásra jelenik meg
    requestAnimationFrame(() => focusItem(first));
  }

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function onButtonKey(e) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu(0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu(items.length - 1);
    }
  }

  function onMenuKey(e) {
    const i = itemRefs.current.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusItem(i + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusItem(i - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      focusItem(items.length - 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    }
  }

  function choose(item) {
    // a fókusz a gombra kerül: a megnyíló ablak bezárásakor oda tér vissza
    close();
    item.onSelect();
  }

  return (
    <div className="more" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="more-btn"
        aria-label="További műveletek"
        title="További műveletek"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openMenu(0))}
        onKeyDown={onButtonKey}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="5" r="1.9" fill="currentColor" />
          <circle cx="12" cy="12" r="1.9" fill="currentColor" />
          <circle cx="12" cy="19" r="1.9" fill="currentColor" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          className={side === 'left' ? 'more-menu to-left' : 'more-menu'}
          role="menu" aria-label="További műveletek" onKeyDown={onMenuKey}>
          {items.map((item, i) => (
            <button
              key={item.id}
              ref={(el) => (itemRefs.current[i] = el)}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="more-item"
              aria-labelledby={`${menuId}-${item.id}`}
              aria-describedby={`${menuId}-${item.id}-desc`}
              onClick={() => choose(item)}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {ICONS[item.icon]}
              </svg>
              <span className="more-text">
                <span id={`${menuId}-${item.id}`} className="more-label">
                  {item.label}
                </span>
                <span id={`${menuId}-${item.id}-desc`} className="more-desc">
                  {item.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
