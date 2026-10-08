'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { popupSide } from '@/lib/popupSide';
import { formatDate } from '@/lib/titles';
import { article } from '@/components/Seasons';

const THUMB_BASE = 'https://image.tmdb.org/t/p/w92';

// "Megjelent az 5. évad" / "Bejelentették a 4. évadot – várható: 2026. 12. 01." /
// filmnél: "Digitálisan is megjelent – már letölthető"
function describe(n) {
  if (n.kind === 'movie_digital') return 'Digitálisan is megjelent – már letölthető';
  if (n.kind === 'mama_interested') return 'Mamát érdekli'; // Mama jelölte a saját oldalán (terv-3 13)
  const nth = `${article(n.season_number)} ${n.season_number}.`;
  if (n.kind === 'season_aired') return `Megjelent ${nth} évad`;
  return `Bejelentették ${nth} évadot${n.air_date ? ` – várható: ${formatDate(n.air_date)}` : ''}`;
}

// Harang a fejlécben: a nem olvasott értesítések száma, kinyitva a legutóbbiak (új évad
// bejelentése / megjelenése, film digitális megjelenése). Kinyitáskor mind olvasott lesz (az
// akkor újak kiemelve maradnak, amíg nyitva van); egy értesítésre kattintva a cím szerkesztő
// ablaka nyílik. Törlés (Norbi kérése, 2026-10-07): soronként × (egérrel rámutatva / fókusznál
// látszik, érintőképernyőn mindig), fölül „Összes törlése”; a Watchlist onRemove-ja azonnal elveszi,
// az értesítősávban „Visszavonás”.
// Fajtánként saját szín (terv-3 51.5, 2026-10-09): megjelent évad zsálya, bejelentett évad indigó,
// digitális megjelenés égkék, Mama borostyán – a borító sarkán ikon, a leírás színe (CSS: data-kind).
// Kattintás kívül / Esc: bezár.
export default function NotificationBell({ notifications, titles, onOpenTitle, onRead, onRemove }) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState('left'); // a lista a harang melyik széléhez igazodik
  const [fresh, setFresh] = useState(() => new Set()); // a kinyitáskor még olvasatlanok
  const panelId = useId();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);

  // a törölt sor helyén a következő (különben az előző) sor törlőgombja kapja a fókuszt
  function remove(n, index) {
    onRemove([n]);
    requestAnimationFrame(() => {
      const left = listRef.current?.querySelectorAll('.notif-del');
      const next = left?.[Math.min(index, left.length - 1)];
      (next ?? buttonRef.current)?.focus();
    });
  }

  const byId = useMemo(() => new Map(titles.map((t) => [t.id, t])), [titles]);
  const items = notifications.filter((n) => byId.has(n.title_id)); // törölt sorozat nélkül
  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // új értesítés érkezett (több az olvasatlan, mint eddig): a harang egyszer megrezzen
  const [seenUnread, setSeenUnread] = useState(0);
  const [ringing, setRinging] = useState(false);
  if (unread !== seenUnread) {
    if (unread > seenUnread) setRinging(true);
    setSeenUnread(unread);
  }

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setFresh(new Set(items.filter((n) => !n.read_at).map((n) => n.id)));
    setSide(popupSide(buttonRef.current, 400, 'left'));
    setOpen(true);
    if (unread > 0) onRead();
  }

  return (
    <div
      className="notif"
      ref={rootRef}
      onKeyDown={(e) => {
        if (open && e.key === 'Escape') {
          e.preventDefault();
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={ringing ? 'notif-bell ringing' : 'notif-bell'}
        onAnimationEnd={() => setRinging(false)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread ? `Értesítések: ${unread} új` : 'Értesítések'}
        title="Értesítések"
        data-unread={unread > 0 ? '' : undefined}
        onClick={toggle}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="notif-count" aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          className={side === 'right' ? 'notif-panel to-right' : 'notif-panel'}
          role="region"
          aria-label="Értesítések"
        >
          <div className="notif-head">
            <p>Értesítések</p>
            {items.length > 0 && (
              <button
                type="button"
                className="notif-clear"
                onClick={() => {
                  onRemove(items);
                  buttonRef.current?.focus();
                }}
              >
                Összes törlése
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="notif-empty">
              Még nincs értesítés. Itt jelzem, ha egy sorozatodhoz új évadot jelentenek be, ha
              egy évad megjelenik, vagy ha egy várt film digitálisan is elérhető lesz.
            </p>
          ) : (
            <ul className="notif-list" ref={listRef}>
              {items.map((n, index) => {
                const t = byId.get(n.title_id);
                const isNew = fresh.has(n.id);
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className="notif-item"
                      data-new={isNew ? '' : undefined}
                      data-kind={n.kind}
                      onClick={() => {
                        setOpen(false);
                        onOpenTitle(t);
                      }}
                    >
                      {/* a fajta színe és ikonja a borító sarkán (terv-3 51.5); a szöveg mondja ki */}
                      <span className="notif-pic">
                        <span className="notif-thumb">
                          {t.poster_path && <img src={THUMB_BASE + t.poster_path} alt="" loading="lazy" />}
                        </span>
                        <span className="notif-kind" aria-hidden="true" />
                      </span>
                      <span className="notif-text">
                        <span className="notif-title">
                          {t.title}
                          {isNew && <span className="sr-only"> (új)</span>}
                        </span>
                        <span className="notif-what">{describe(n)}</span>
                        <time className="notif-when" dateTime={n.created_at}>
                          {formatDate(n.created_at)}
                        </time>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="notif-del"
                      aria-label={`Értesítés törlése: ${t.title}`}
                      title="Törlés"
                      onClick={() => remove(n, index)}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
