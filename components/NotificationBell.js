'use client';

import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { popupSide } from '@/lib/popupSide';
import { usePhonePopup } from '@/lib/usePhonePopup';
import { formatDate } from '@/lib/titles';
import { budapestToday } from '@/lib/refreshDue';
import { useBackLayer } from '@/lib/backClose';
import { shownNotifications } from '@/lib/notifications';
import { article } from '@/components/Seasons';

const THUMB_BASE = 'https://image.tmdb.org/t/p/w92';
const PHOTO_BASE = 'https://image.tmdb.org/t/p/w45'; // a követett személy fotója a borító sarkán (M4)

// a harang csoportjai (terv-3 76, Norbi választása: „A”, 2026-10-13): az értesítés napja (budapesti
// idővel) szerint „Ma” / „Ezen a héten” (a hét hétfőtől számít) / „Korábban”
export function dayGroup(createdAt, today) {
  const day = new Date(createdAt).toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });
  if (day >= today) return 'Ma';
  const t = new Date(`${today}T00:00:00Z`);
  const monday = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
  return day >= monday ? 'Ezen a héten' : 'Korábban';
}

// "Megjelent az 5. évad" / "Bejelentették a 4. évadot – várható: 2026. 12. 01." /
// filmnél: "Digitálisan is megjelent – már letölthető"
function describe(n, franchiseName) {
  if (n.kind === 'collection_new') {
    // új rész a franchise TMDB-gyűjteményében (terv-3 36); a még meg nem jelentnél a várható dátum
    const name = franchiseName.get(n.franchise_id);
    const soon = n.air_date && n.air_date > budapestToday(); // helyi nappal (kódaudit #31)
    return `Új rész a gyűjteményben – ${name}${soon ? ` · várható: ${formatDate(n.air_date)}` : ''}`;
  }
  if (n.kind === 'person_new') {
    // követett színész / rendező új filmje (M4); csak dátummal bejelentett filmről szól
    const soon = n.air_date && n.air_date > budapestToday();
    return `${n.person_name} új filmje · ${soon ? 'várható' : 'megjelent'}: ${formatDate(n.air_date)}`;
  }
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
// Új rész egy franchise TMDB-gyűjteményében (terv-3 36): a rész nincs a listán – a sorban a saját
// címe, éve és borítója (az értesítés tárolja), kattintva az előnézete nyílik (onOpenTitle egy
// TMDB-tétellel; a TitleEditor a TMDB-azonosító szerint dönti el, listán van-e már).
// Fajtánként saját szín (terv-3 51.5, 2026-10-09): megjelent évad zsálya, bejelentett évad indigó,
// digitális megjelenés égkék, Mama borostyán, új rész korall – a borító sarkán ikon, a leírás színe (CSS: data-kind).
// Követett személy új filmje (M4, person_new): mint az új rész, a borító sarkán a személy kerek fotója (indigó gyűrű).
// Kattintás kívül / Esc: bezár.
// readOnly: net nélkül (terv-3 44) csak olvasni lehet – nincs törlés, és a kinyitás sem jelöli
// olvasottnak (az adatbázisba úgysem jutna el; kódaudit #8)
// quiet: a megjelenéskor nem rezzen meg (a letapadt szűrősor másodpéldánya – minden letapadáskor újra megjelenik)
export default function NotificationBell({ notifications, titles, franchiseName, onOpenTitle, onRead, onRemove, readOnly, quiet }) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState('left'); // a lista a harang melyik széléhez igazodik
  const [fresh, setFresh] = useState(() => new Set()); // a kinyitáskor még olvasatlanok
  const panelId = useId();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const panelRef = useRef(null); // telefonon a body-ban (usePhonePopup)

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
  // törölt cím / franchise nélkül
  const items = shownNotifications(notifications, byId, franchiseName);
  const unread = items.filter((n) => !n.read_at).length;
  const today = open ? budapestToday() : null; // a csoportokhoz (kinyitáskor számolva)

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current.contains(e.target) && !panelRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // új értesítés érkezett (több az olvasatlan, mint eddig): a harang egyszer megrezzen
  const [seenUnread, setSeenUnread] = useState(() => (quiet ? unread : 0));
  const [ringing, setRinging] = useState(false);
  if (unread !== seenUnread) {
    if (unread > seenUnread) setRinging(true);
    setSeenUnread(unread);
  }

  // a Vissza gomb is bezárja (terv-3 62)
  useBackLayer(open, () => setOpen(false));
  const phonePopup = usePhonePopup(open, buttonRef);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setFresh(new Set(items.filter((n) => !n.read_at).map((n) => n.id)));
    setSide(popupSide(buttonRef.current, 400, 'left'));
    setOpen(true);
    if (unread > 0 && !readOnly) onRead();
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

      {phonePopup.render(
        open && (
          <div
            ref={panelRef}
            style={phonePopup.style}
            id={panelId}
            className={side === 'right' ? 'notif-panel to-right' : 'notif-panel'}
            role="region"
            aria-label="Értesítések"
          >
            <div className="notif-head">
              <p>Értesítések</p>
              {items.length > 0 && !readOnly && (
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
                egy évad megjelenik, ha egy várt film digitálisan is elérhető lesz, ha Mamát érdekel
                egy film, ha új rész jelenik meg egy franchise-od gyűjteményében, vagy ha egy követett
                színészed, rendeződ új filmjét bejelentik.
              </p>
            ) : (
              <ul className="notif-list" ref={listRef}>
                {items.map((n, index) => {
                  // csoportcím, ahol a nap kategóriája változik (a lista a legújabbal kezdődik)
                  const group = dayGroup(n.created_at, today);
                  const head = index === 0 || dayGroup(items[index - 1].created_at, today) !== group;
                  // a gyűjtemény új része / a követett személy új filmje nincs a listán: az értesítés
                  // adataiból (TMDB-tétel – előnézet)
                  const part = n.kind === 'collection_new' || n.kind === 'person_new';
                  const t =
                    part
                      ? {
                          media_type: 'movie',
                          tmdb_id: n.part_tmdb_id,
                          title: n.part_title,
                          poster_path: n.part_poster_path,
                          release_year: n.part_year,
                        }
                      : byId.get(n.title_id);
                  const label = part && n.part_year ? `${t.title} (${n.part_year})` : t.title;
                  const isNew = fresh.has(n.id);
                  return (
                    <Fragment key={n.id}>
                    {head && (
                      <li className="notif-group" role="presentation">
                        {group}
                      </li>
                    )}
                    <li>
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
                          <span className="notif-kind" aria-hidden="true">
                            {n.kind === 'person_new' && n.person_profile_path && (
                              <img src={PHOTO_BASE + n.person_profile_path} alt="" loading="lazy" />
                            )}
                          </span>
                        </span>
                        <span className="notif-text">
                          <span className="notif-title">
                            {label}
                            {isNew && <span className="sr-only"> (új)</span>}
                          </span>
                          <span className="notif-what">{describe(n, franchiseName)}</span>
                          <time className="notif-when" dateTime={n.created_at}>
                            {formatDate(n.created_at)}
                          </time>
                        </span>
                      </button>
                      {!readOnly && (
                        <button
                          type="button"
                          className="notif-del"
                          aria-label={`Értesítés törlése: ${label}`}
                          title="Törlés"
                          onClick={() => remove(n, index)}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                            <path d="M6 6l12 12M18 6L6 18" />
                          </svg>
                        </button>
                      )}
                    </li>
                    </Fragment>
                  );
                })}
              </ul>
            )}
          </div>
        )
      )}
    </div>
  );
}
