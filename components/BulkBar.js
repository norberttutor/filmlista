'use client';

// A tömeges szerkesztés műveletsávja (terv-3 145, „A”): kijelöléskor alul középen lebeg (a szűrők a helyükön
// maradnak). Bal oldalt a darabszám és a „Mind…” ajánlat, utána a műveletek lenyílói (Állapot, Letöltve, Franchise,
// Mama) és a Törlés – az előbb megerősítést kér (a sávon belül), utána 8 mp-ig visszavonható.
import { useEffect, useRef, useState } from 'react';
import { DOWNLOAD_ICONS, FRANCHISE_ICON, MAMA_ICON, MamaDot, STATUS_ICONS } from '@/components/FilterIcons';
import { DROPPED_STATUS, MAMA_OPTIONS, mamaApplies } from '@/lib/titles';

const X_ICON = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const TRASH_ICON = (
  <svg className="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
  </svg>
);

const CHEVRON_UP = (
  <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
    <path d="M2 8l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const NO_FRANCHISE_ICON = (
  <svg className="filter-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l9 4.5-9 4.5-9-4.5z" />
    <path d="M4 4l16 16" />
  </svg>
);

const ACTIONS = [
  { id: 'status', label: 'Állapot', icon: STATUS_ICONS.watched },
  { id: 'download', label: 'Letöltve', icon: DOWNLOAD_ICONS.yes },
  { id: 'franchise', label: 'Franchise', icon: FRANCHISE_ICON },
  { id: 'mama', label: 'Mama', icon: MAMA_ICON },
];

// bulk: useBulkEdit(); statuses: az állapotok (code, name); franchises: { id, name }[]
export default function BulkBar({ bulk, statuses, franchises }) {
  const [menu, setMenu] = useState(null); // a nyitott lenyíló azonosítója
  const [confirming, setConfirming] = useState(false); // törlés előtti kérdés
  const rootRef = useRef(null);
  const n = bulk.count;

  // a nyitott menü kattintásra kívül bezárul
  useEffect(() => {
    if (!menu) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menu]);

  // megnyitáskor a menü első választható pontja kapja a fókuszt
  useEffect(() => {
    if (menu) rootRef.current?.querySelector('.bulk-menu [role="menuitem"]:not([aria-disabled="true"])')?.focus();
  }, [menu]);

  useEffect(() => {
    if (confirming) rootRef.current?.querySelector('.bb-confirm .danger')?.focus();
  }, [confirming]);

  function closeMenu() {
    const id = menu;
    setMenu(null);
    rootRef.current?.querySelector(`[data-menu="${id}"]`)?.focus();
  }

  // a menüben: nyilakkal lépked, Esc bezárja (a kijelölést nem szünteti meg)
  function onMenuKey(e) {
    const items = [...e.currentTarget.querySelectorAll('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      items[(i + step + items.length) % items.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeMenu();
    } else if (e.key === 'Tab') {
      setMenu(null);
    }
  }

  function choose(what, value) {
    setMenu(null);
    bulk.apply(what, value);
  }

  const rows = bulk.selected;
  const cnt = (fn) => rows.filter(fn).length || null;

  function items(which) {
    if (which === 'status') {
      const films = rows.filter((t) => t.media_type !== 'tv').length;
      return statuses.map((s) => (
        <Item
          key={s.code}
          lead={<span className="bulk-dot" data-status={s.code} aria-hidden="true" />}
          text={s.name}
          n={cnt((t) => t.status === s.code)}
          why={s.code === DROPPED_STATUS && films ? `Csak sorozatnál – a kijelölésben ${films} film is van` : ''}
          onSelect={() => choose('status', s.code)}
        />
      ));
    }
    if (which === 'download') {
      return [
        <Item key="yes" lead={DOWNLOAD_ICONS.yes} text="Letöltve" n={cnt((t) => t.is_downloaded)} onSelect={() => choose('download', true)} />,
        <Item key="no" lead={DOWNLOAD_ICONS.no} text="Nem letöltött" n={cnt((t) => !t.is_downloaded)} onSelect={() => choose('download', false)} />,
      ];
    }
    if (which === 'mama') {
      const none = !rows.some((t) => mamaApplies(t));
      const why = none ? 'Mama csak a franchise nélküli filmeknél jelölhető' : '';
      return [
        ...MAMA_OPTIONS.map((o) => (
          <Item
            key={o.code}
            lead={<MamaDot code={o.code} />}
            text={o.name}
            n={cnt((t) => t.mama_status === o.code)}
            why={why}
            onSelect={() => choose('mama', o.code)}
          />
        )),
        <div key="sep" className="menu-sep" role="separator" />,
        <Item key="none" lead={DOWNLOAD_ICONS.no} text="Nincs jelölés" n={cnt((t) => !t.mama_status)} onSelect={() => choose('mama', null)} />,
      ];
    }
    return [
      ...franchises.map((f) => (
        <Item key={f.id} lead={FRANCHISE_ICON} text={f.name} n={cnt((t) => t.franchise_id === f.id)} onSelect={() => choose('franchise', f.id)} />
      )),
      franchises.length > 0 && <div key="sep" className="menu-sep" role="separator" />,
      <Item key="none" lead={NO_FRANCHISE_ICON} text="Nincs franchise" n={cnt((t) => t.franchise_id == null)} onSelect={() => choose('franchise', null)} />,
    ];
  }

  // a „Mind…” ajánlat: az oldal még nem mind → „Mind kijelölése” (az oldal); az oldal mind, de több a találat →
  // „Mind a N találat kijelölése”; az összes találat → „Csak az oldal (N)”
  let offer = null;
  if (bulk.allMatches) {
    if (bulk.matchCount > bulk.pageCount) {
      offer = (
        <button type="button" className="bb-all" onClick={bulk.onlyPage}>
          Csak az oldal ({bulk.pageCount})
        </button>
      );
    }
  } else if (bulk.pageState !== 'all') {
    offer = (
      <button type="button" className="bb-all" onClick={bulk.selectPage}>
        Mind kijelölése
      </button>
    );
  } else if (bulk.matchCount > n) {
    offer = (
      <button type="button" className="bb-all" onClick={bulk.selectAllMatches}>
        Mind a {bulk.matchCount} találat kijelölése
      </button>
    );
  }

  return (
    <div className="bulk-bar" role="toolbar" aria-label="Kijelölt címek" ref={rootRef}>
      {confirming ? (
        <div
          className="bb-confirm"
          role="alertdialog"
          aria-label="Törlés megerősítése"
          // az Esc a kérdést zárja, a kijelölés marad
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            setConfirming(false);
          }}
        >
          <span className="bb-question">
            Törlöd a kijelölt <b>{n} címet</b>? 8 mp-ig visszavonható.
          </span>
          <button
            type="button"
            className="danger"
            onClick={() => {
              setConfirming(false);
              bulk.remove();
            }}
          >
            Törlés
          </button>
          <button type="button" className="ghost" onClick={() => setConfirming(false)}>
            Mégse
          </button>
        </div>
      ) : (
        <>
          <button type="button" className="bb-x" aria-label="Kijelölés megszüntetése" title="Kijelölés megszüntetése (Esc)" onClick={bulk.clear}>
            {X_ICON}
          </button>
          <span className="bb-count" aria-live="polite">
            <b>{n}</b> kijelölve
          </span>
          {offer}
          <span className="bb-sep" aria-hidden="true" />
          {ACTIONS.map((a) => (
            <div className="bb-act" key={a.id}>
              <button
                type="button"
                className="bb-btn"
                data-menu={a.id}
                aria-haspopup="menu"
                aria-expanded={menu === a.id}
                onClick={() => setMenu((m) => (m === a.id ? null : a.id))}
              >
                {a.icon}
                {a.label}
                {CHEVRON_UP}
              </button>
              {menu === a.id && (
                <div className="bulk-menu" role="menu" aria-label={a.label} onKeyDown={onMenuKey}>
                  {items(a.id)}
                </div>
              )}
            </div>
          ))}
          <span className="bb-sep" aria-hidden="true" />
          <button type="button" className="bb-btn del" onClick={() => setConfirming(true)}>
            {TRASH_ICON}
            Törlés
          </button>
        </>
      )}
    </div>
  );
}

// a menü egy pontja: ikon | felirat | hány kijelölt cím ilyen most; a tiltottnál alatta, miért
function Item({ lead, text, n, why, onSelect }) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-disabled={why ? 'true' : undefined}
      onClick={() => !why && onSelect()}
    >
      {lead}
      <span>{text}</span>
      <span className="n">{n ?? ''}</span>
      {why && <span className="why">{why}</span>}
    </button>
  );
}
