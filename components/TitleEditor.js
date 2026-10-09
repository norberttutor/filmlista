'use client';

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { flushSync } from 'react-dom';
import {
  addTitle,
  updateTitle,
  todayDate,
  releaseState,
  DEFAULT_STATUS,
  DROPPED_STATUS,
  MAMA_OPTIONS,
} from '@/lib/titles';
import StarRating from '@/components/StarRating';
import FranchiseSelect from '@/components/FranchiseSelect';
import { Lock } from '@/components/TitleTable';
import ImdbBadge from '@/components/ImdbBadge';
import ReleaseBadge from '@/components/ReleaseBadge';
import WatchProviders from '@/components/WatchProviders';
import TopCast from '@/components/TopCast';
import { hasSeasons, SeasonList, SeasonTimeline, useSeasonActions } from '@/components/Seasons';
import SimilarTitles from '@/components/SimilarTitles';
import { usePosterColor, ambientProps } from '@/lib/posterColor';
import { canMorph, MORPH_NAME, afterTransition } from '@/lib/viewTransition';
import { useBackdropClose } from '@/lib/useBackdropClose';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w500'; // a nagy borító (asztalon)
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/'; // a háttérkép (telefonon w780, asztalon w1280)
const PHONE_QUERY = '(max-width: 640px)';

// Rádiógombok "chip" formában; a kiválasztottra újra kattintva visszaáll üresre.
const DOWNLOADED_OPTIONS = [{ code: 'yes', name: 'Letöltve' }];

function ClearableChips({ name, options, value, onChange, className }) {
  return (
    <div className={className ? `segmented ${className}` : 'segmented'}>
      {options.map((o) => (
        <label key={o.code}>
          <input
            type="radio"
            name={name}
            value={o.code}
            checked={value === o.code}
            onChange={() => onChange(o.code)}
            onClick={() => value === o.code && onChange(null)}
          />
          <span>{o.name}</span>
        </label>
      ))}
    </div>
  );
}

// Felugró ablak egy cím adatlapjával. A listán lévő címnél a saját adatai szerkeszthetők és a
// cím törölhető; a még nem listán lévőnél (a Cím hozzáadása találatai, a Felfedezés, a Hasonló
// címek) előnézet: ugyanaz az adatlap a TMDB-ről, a szerkesztő mezők helyett egy „Hozzáadás a
// listához” gombbal – felvétel után a lap helyben a rendes adatlapra vált (Norbi döntése).
// Az ablakban több adatlap lehet egymás mögött: a Hasonló címek borítójára kattintva a hasonló
// cím kerül előre, a „Vissza” az előzőre lép (az elhagyott lap rejtve megmarad, a görgetési
// helyével együtt). A natív <dialog> elemet használja: Esc-re bezárul, a fókusz az ablakban
// marad; asztalon a háttérre kattintva is bezárul, ha nincs mentetlen módosítás.
export default function TitleEditor({
  title: opened, // a megnyitott cím: a lista sora, vagy egy TMDB-találat (előnézet)
  titles, // a lista: a lapok mindig a friss sort mutatják, és innen tudják, mi van már a listán
  morphTo, // a borító, amelyről nyílt: bezáráskor oda siklik vissza (nézetváltás)
  onClose,
  ...pageProps
}) {
  const dialogRef = useRef(null);
  const drag = useRef(null); // telefonon a lehúzás: { y, t, dy }
  const pageRef = useRef(null); // az elöl lévő lap: { canLeave(), nudge() }
  const nextId = useRef(1);
  const scrolls = useRef(new Map()); // lap → görgetési hely (a „Vissza” ide tér vissza)
  // a megnyitott adatlapok, az utolsó látszik; added: előnézetből most került a listára
  const [stack, setStack] = useState(() => [{ id: 0, rowId: opened.id ?? null, item: opened, added: false }]);

  // a lap sora a listából: a listáról nyitottnál azonosító szerint (ha közben lekerült – törlés –,
  // a megnyitáskori), a többinél a TMDB-azonosító szerint (null: nincs a listán → előnézet)
  function rowOf(entry) {
    if (entry.rowId != null) return titles.find((x) => x.id === entry.rowId) ?? entry.item;
    const { media_type, tmdb_id } = entry.item;
    return titles.find((x) => x.media_type === media_type && x.tmdb_id === tmdb_id) ?? null;
  }
  const pages = stack.map((entry) => ({ ...entry, row: rowOf(entry) }));
  const top = pages[pages.length - 1];
  const topPreview = !top.row;
  // a borító hangulatszíne: az ablak a film színében dereng (globals.css, "Hangulatszín")
  const ambient = usePosterColor((top.row ?? top.item).poster_path);

  // rajzolás előtt nyílik meg (a nézetváltás új képén már ott legyen az ablak). Lapváltáskor
  // (Vissza, hasonló cím, felvétel) a lap a régi görgetési helyére ugrik (az újak a tetejükre).
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal(); // fejlesztői módban az effect kétszer fut
    dialog.scrollTop = scrolls.current.get(top.id) ?? 0;
    scrolls.current.delete(top.id);
    // a böngésző az első mezőre (Franchise) tenné a fókuszt, és a kerete feleslegesen
    // világítana: helyette az ablak címe kapja (billentyűzettel a Tab innen a Franchise-ra visz)
    dialog.querySelector('.editor-page:not([hidden]) h2')?.focus({ preventScroll: true });
  }, [top.id, topPreview]);

  // a dialog "close" eseménye hívja az onClose-t (Esc-nél is). Asztalon a nagy borító
  // visszasiklik a kártya / sor borítójára (nézetváltás), ha az még a helyén van, és még a
  // megnyitott cím látszik.
  function close() {
    const dialog = dialogRef.current;
    if (stack.length > 1 || !canMorph(morphTo)) {
      dialog.close();
      return;
    }
    const transition = document.startViewTransition(() => {
      morphTo.style.viewTransitionName = MORPH_NAME;
      dialog.close();
    });
    transition.finished
      .catch(() => {})
      .finally(() => {
        morphTo.style.viewTransitionName = '';
      });
  }

  // Asztalon az ablakon kívülre (a sötét háttérre) kattintva bezárul – Norbi kérése –, kivéve,
  // ha az elöl lévő lapon mentetlen módosítás van: akkor figyelmeztet. Nyitva marad akkor is, ha
  // épp a törlést erősítenéd meg, vagy a Franchise mezőben új nevet / átnevezést gépelsz, vagy
  // épp felveszed a címet (lib/useBackdropClose: a kifelé húzott kijelölés sem zár, telefonon –
  // alsó lap – a lehúzás zár). Az Esc továbbra is mindig bezárja (onCancel).
  const backdrop = useBackdropClose(dialogRef, {
    onClose: close,
    canClose: () => pageRef.current?.canLeave() ?? true,
    onBlocked: () => pageRef.current?.nudge(),
  });

  // lapváltás előtt: mentetlen módosítással a lap nem hagyható el (mint a kikattintásnál)
  function canLeavePage() {
    const page = pageRef.current;
    if (!page || page.canLeave()) return true;
    page.nudge();
    return false;
  }

  // a Hasonló címek borítója: a cím adatlapja kerül előre (a listán lévőé szerkeszthető)
  function openPreview(item) {
    if (!canLeavePage()) return;
    scrolls.current.set(top.id, dialogRef.current.scrollTop);
    const id = nextId.current++;
    setStack((s) => [...s, { id, rowId: null, item, added: false }]);
  }

  function goBack() {
    if (!canLeavePage()) return;
    setStack((s) => s.slice(0, -1));
  }

  function markAdded(id) {
    setStack((s) => s.map((entry) => (entry.id === id ? { ...entry, added: true } : entry)));
  }

  // telefonon az ablak alsó lap: a fogantyút lefelé húzva bezárul (elég messzire vagy gyorsan),
  // különben visszaugrik
  function dragStart(e) {
    if (!window.matchMedia(PHONE_QUERY).matches) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    dialogRef.current.style.transition = 'none';
  }

  function dragMove(e) {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    dialogRef.current.style.translate = `0 ${drag.current.dy}px`;
  }

  function dragEnd() {
    if (!drag.current) return;
    const { dy, t } = drag.current;
    drag.current = null;
    const dialog = dialogRef.current;
    dialog.style.transition = '';
    const fast = dy / (performance.now() - t) > 0.6; // px/ms
    if (dy > 110 || (fast && dy > 30)) {
      dialog.style.translate = '0 100%';
      setTimeout(close, 180);
    } else {
      dialog.style.translate = '';
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="editor title-editor"
      aria-labelledby="editor-title"
      onClose={onClose}
      onCancel={(e) => {
        // Esc: a saját bezárás (nézetváltással), nem a böngésző azonnali bezárása
        e.preventDefault();
        close();
      }}
      {...backdrop}
      {...ambientProps(ambient)}
    >
      {/* telefonon: fogantyú – lefelé húzva bezárja az ablakot (a Mégse / Esc ugyanaz) */}
      <div
        className="sheet-handle"
        aria-hidden="true"
        onPointerDown={dragStart}
        onPointerMove={dragMove}
        onPointerUp={dragEnd}
        onPointerCancel={dragEnd}
      />
      {pages.map((page, i) => {
        const active = i === pages.length - 1;
        const prev = pages[i - 1];
        return (
          // felvételkor (előnézet → sor) új lap: a szerkesztő mezők a friss sorból indulnak
          <TitlePage
            key={`${page.id}:${page.row ? 'row' : 'preview'}`}
            entry={page}
            active={active}
            apiRef={active ? pageRef : null}
            back={prev ? (prev.row ?? prev.item).title : null}
            onBack={goBack}
            onPreview={openPreview}
            onAddedHere={() => markAdded(page.id)}
            close={close}
            closeNow={() => dialogRef.current.close()}
            {...pageProps}
          />
        );
      })}
    </dialog>
  );
}

// Egy adatlap az ablakban: listán lévő címnél (entry.row) szerkeszthető, különben előnézet.
// Sorozatnál az állapot és a "Letöltve" helyett az évadlista látszik; az évadok változása
// azonnal mentődik (onChanged), a többi mező a "Mentés" gombbal.
function TitlePage({
  entry,
  active, // ez látszik (a többi rejtve, az ablakban hátrébb)
  apiRef, // az elöl lévő lapé: az ablak ezen kérdezi, elhagyható-e
  back, // az előző lap címe („Vissza: …”), vagy null
  onBack,
  onPreview,
  onAddedHere,
  close, // az ablak bezárása (nézetváltással)
  closeNow, // azonnal (törléskor: nincs hova visszasiklani)
  statuses,
  franchises,
  onCreateFranchise,
  onDeleteFranchise,
  onRenameFranchise,
  existingKeys,
  onAdded,
  onSaved,
  onChanged,
  onDelete,
  readOnly, // net nélkül (terv-3 44): csak nézni lehet
}) {
  const row = entry.row;
  const preview = !row;
  const pageEl = useRef(null);
  const deleteButtonRef = useRef(null);

  // előnézetnél a cím adatai a TMDB-ről (/api/tmdb/details; felvételkor ugyanezek kerülnek a
  // listára, nem kérdezzük le újra); amíg jönnek, a találat adatai (cím, év, borító) látszanak
  const [details, setDetails] = useState(null);
  const [detailsError, setDetailsError] = useState('');
  const { media_type, tmdb_id } = entry.item;
  useEffect(() => {
    if (!preview) return;
    const controller = new AbortController();
    apiGet('/api/tmdb/details', { type: media_type, id: tmdb_id }, { signal: controller.signal })
      .then((data) => afterTransition().then(() => !controller.signal.aborted && setDetails(data)))
      .catch((err) => err.name !== 'AbortError' && setDetailsError(err.message));
    return () => controller.abort();
  }, [preview, media_type, tmdb_id]);
  const t = row ?? { ...entry.item, ...details };

  // a megnyitáskori értékek (ehhez képest van-e mentetlen módosítás)
  const [initial] = useState(() => ({
    status: t.status,
    is_downloaded: t.is_downloaded,
    mama_status: t.mama_status ?? null,
    franchise_id: t.franchise_id ?? null,
    my_rating: t.my_rating ?? null,
    watched_at: t.watched_at ?? '',
  }));
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const seasonal = hasSeasons(t);
  // mentetlen módosítás: amit a "Mentés" küldene, eltér a megnyitáskoritól (az évadok azonnal
  // mentődnek, azok nem számítanak; a dátum csak megnézett címnél kerül mentésre)
  const dirty =
    !preview &&
    (form.mama_status !== initial.mama_status ||
      form.franchise_id !== initial.franchise_id ||
      form.my_rating !== initial.my_rating ||
      (!seasonal &&
        (form.status !== initial.status ||
          form.is_downloaded !== initial.is_downloaded ||
          (form.status === 'watched' && form.watched_at !== initial.watched_at))));
  // kikattintás / lapváltás mentetlen módosítással: figyelmeztetés a gombok mellett, a "Mentés"
  // felvillan
  const [nudged, setNudged] = useState(false);
  const [attention, setAttention] = useState(false);
  const seasonActions = useSeasonActions(t, onChanged, setError);
  // előzetes a TMDB-ről (magyar, ha nincs: angol): megnyitáskor a háttérben kérdezzük le; a gomb
  // csak akkor jelenik meg, ha van. A lejátszó csak kattintásra töltődik (YouTube, adatkímélő mód).
  // A háttérben érkező adatok a megnyitás mozgásának végét megvárják (afterTransition).
  const [trailer, setTrailer] = useState(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    apiGet('/api/tmdb/videos', { type: t.media_type, id: t.tmdb_id }, { signal: controller.signal })
      .then((data) => afterTransition().then(() => !controller.signal.aborted && setTrailer(data.video)))
      .catch((err) => err.name !== 'AbortError' && console.warn('Előzetes:', err.message));
    return () => controller.abort();
  }, [t.media_type, t.tmdb_id]);
  // az elhagyott (rejtett) lapon nem szól tovább az előzetes
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) setPlaying(false);
  }
  // „Hol nézhető?”: a magyarországi streamingszolgáltatók, szintén a háttérben (ha nincs, vagy
  // nem sikerül, a blokk nem jelenik meg)
  const [providers, setProviders] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    apiGet('/api/tmdb/providers', { type: t.media_type, id: t.tmdb_id }, { signal: controller.signal })
      .then((data) => afterTransition().then(() => !controller.signal.aborted && setProviders(data.providers)))
      .catch((err) => err.name !== 'AbortError' && console.warn('Hol nézhető:', err.message));
    return () => controller.abort();
  }, [t.media_type, t.tmdb_id]);

  // szereplők (terv-3 38): a top cast első 3 tagja, szintén a háttérben, a mozgás után
  const [cast, setCast] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    apiGet('/api/tmdb/credits', { type: t.media_type, id: t.tmdb_id }, { signal: controller.signal })
      .then((data) => afterTransition().then(() => !controller.signal.aborted && setCast(data.cast)))
      .catch((err) => err.name !== 'AbortError' && console.warn('Szereplők:', err.message));
    return () => controller.abort();
  }, [t.media_type, t.tmdb_id]);

  // nyitva marad az ablak (kikattintásra, lapváltáskor), ha épp a törlést erősítenéd meg, a
  // Franchise mezőben új nevet / átnevezést gépelsz, menteni vagy felvenni készülsz
  const editingElsewhere = () =>
    busy || confirmingDelete || Boolean(pageEl.current?.querySelector('.franchise-new'));
  useImperativeHandle(apiRef, () => ({
    canLeave: () => !editingElsewhere() && !dirty,
    nudge: () => {
      if (!dirty || editingElsewhere()) return;
      setNudged(true);
      setAttention(true);
      setTimeout(() => setAttention(false), 450);
    },
  }));

  // az idővonal pöttyére kattintva a lista az évadhoz görget, és annak első gombja kapja a fókuszt
  function pickSeason(n) {
    const seasonRow = pageEl.current?.querySelector(`.season-list li[data-season="${n}"]`);
    seasonRow?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    seasonRow?.querySelector('input')?.focus({ preventScroll: true });
  }

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function changeStatus(code) {
    code ??= DEFAULT_STATUS; // a kiválasztott újra kattintva: vissza az (üres) alapállapotba
    setForm((f) => ({
      ...f,
      status: code,
      // megnézettre állításkor a mai nap (a felületen nem látszik, nem szerkeszthető – Norbi
      // kérése; a Statisztika és a CSV-mentés használja)
      watched_at: code === 'watched' && !f.watched_at ? todayDate() : f.watched_at,
      // ...és a "Letöltve" törlődik (az adatbázis-trigger szabálya, itt azonnal látszik)
      is_downloaded: code === 'watched' && f.status !== 'watched' ? false : f.is_downloaded,
    }));
  }

  function cancelDelete() {
    flushSync(() => setConfirmingDelete(false));
    deleteButtonRef.current.focus();
  }

  // előnézet: felvétel a listára (a már lekérdezett adatokkal); utána a lap a rendes adatlapra
  // vált (az ablak új lapot rajzol a friss sorral)
  async function handleAdd() {
    setBusy(true);
    setError('');
    try {
      const added = await addTitle(entry.item, details);
      onAddedHere();
      onAdded(added);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (readOnly) return;
    if (preview) {
      handleAdd();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const saved = await updateTitle(t.id, {
        // sorozatnál az állapotot, a "Letöltve" jelzőt és a dátumot az évadokból számolja
        // az adatbázis
        ...(!seasonal && {
          status: form.status,
          is_downloaded: form.is_downloaded,
          // a dátumnak csak megnézett címnél van értelme
          watched_at: form.status === 'watched' ? form.watched_at || null : null,
        }),
        mama_status: form.mama_status,
        franchise_id: form.franchise_id,
        my_rating: form.my_rating,
      });
      onSaved(saved);
      close();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  // a megerősítés után a cím lekerül, a sávban 8 mp-ig visszavonható (a Watchlist törli)
  function handleDelete() {
    onDelete(t);
    closeNow(); // a cím eltűnik a listáról: nincs hova visszasiklani
  }

  const errorMessage = error && (
    <p className="error" role="alert">
      {error}
    </p>
  );

  return (
    <div ref={pageEl} className={t.backdrop_path ? 'editor-page has-backdrop' : 'editor-page'} hidden={!active}>
      {/* a film széles jelenetképe az ablak tetején (TMDB) */}
      {t.backdrop_path && (
        <div className="editor-backdrop" aria-hidden="true">
          <img
            src={BACKDROP_BASE + 'w1280' + t.backdrop_path}
            srcSet={`${BACKDROP_BASE}w780${t.backdrop_path} 780w, ${BACKDROP_BASE}w1280${t.backdrop_path} 1280w`}
            sizes="(max-width: 640px) 100vw, 60rem"
            alt=""
            decoding="async"
          />
        </div>
      )}
      <form onSubmit={handleSubmit}>
        {/* asztalon a borító nagyban, balra (görgetéskor a helyén marad), alatta a „Hol
            nézhető?”; keskenyebben (< 900 px) rejtve */}
        <div className="editor-side">
          <div className="editor-poster" aria-hidden="true">
            {t.poster_path && <img src={POSTER_BASE + t.poster_path} alt="" decoding="async" />}
          </div>
          <WatchProviders providers={providers} className="side" />
          <TopCast cast={cast} variant="side" />
        </div>
        <div className="editor-main">
          <header>
            {/* a Hasonló címek borítójáról nyílt lapon: vissza az előző címre */}
            {back && (
              <button type="button" className="back-link" onClick={onBack}>
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Vissza: {back}
              </button>
            )}
            <h2 id={active ? 'editor-title' : undefined} tabIndex={-1}>
              {t.title}
            </h2>
            <p className="meta">
              {t.release_year && <span>{t.release_year}</span>}
              <span>{t.media_type === 'tv' ? 'Sorozat' : 'Film'}</span>
              {preview && t.seasons?.length > 0 && <span>{t.seasons.length} évad</span>}
              <ImdbBadge title={t} />
              {/* előnézetnél csak a TMDB-adatokkal (a találatban nincs megjelenési dátum) */}
              {(!preview || details) && <ReleaseBadge state={releaseState(t)} />}
            </p>
            {/* műfajok, pötty nélkül (mint Mama adatlapján; Norbi kérése, 2026-10-08) – előnézetnél a
                TMDB-adatokból ({ id, name }), amint megjöttek */}
            {t.genres?.length > 0 && (
              <p className="editor-genres">{t.genres.map((g) => (typeof g === 'string' ? g : g.name)).join(' · ')}</p>
            )}
            {entry.added && (
              <p className="added-note" role="status">
                ✓ Felkerült a listádra – itt beállíthatod az állapotát és az értékelését.
              </p>
            )}
            {/* keskenyebben (< 900 px, nincs nagy borító) itt, az előzetes fölött */}
            <WatchProviders providers={providers} className="inline" />
            {trailer && (
              <button
                type="button"
                className="ghost trailer-btn"
                aria-expanded={playing}
                onClick={() => setPlaying((p) => !p)}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d={playing ? 'M6 6l12 12M18 6 6 18' : 'M8 5v14l11-7z'} fill={playing ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={playing ? 2.4 : 0} strokeLinecap="round" />
                </svg>
                {playing ? 'Előzetes bezárása' : 'Előzetes megnézése'}
                {!playing && trailer.lang !== 'hu' && <span className="trailer-lang">angolul</span>}
              </button>
            )}
            {playing && trailer && (
              <div className="trailer">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0&hl=hu&cc_lang_pref=hu`}
                  title={`Előzetes: ${t.title}`}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              </div>
            )}
            {t.overview ? (
              <p className="editor-overview">{t.overview}</p>
            ) : (
              preview &&
              !details &&
              !detailsError && (
                <div className="editor-overview-sk" aria-hidden="true">
                  <span className="sk sk-line" />
                  <span className="sk sk-line sk-w80" />
                  <span className="sk sk-line sk-w60" />
                </div>
              )
            )}
            {/* keskenyebben (< 900 px) a szereplők egy sorban a leírás alatt */}
            <TopCast cast={cast} variant="inline" />
          </header>

          {preview ? (
            // előnézet: a szerkesztő mezők helyett egyetlen gomb
            <div className="preview-add">
              <button type="submit" className="primary" disabled={busy || readOnly}>
                {busy ? 'Hozzáadás…' : 'Hozzáadás a listához'}
              </button>
              <p className="muted small">Felvétel után itt beállíthatod az állapotát és az értékelését is.</p>
              {detailsError && (
                <p className="error small" role="alert">
                  {detailsError}
                </p>
              )}
              {errorMessage}
            </div>
          ) : (
            <Lock on={readOnly}>
              {/* tömör elrendezés (terv-3 30, B – „vezérlősáv”, Norbi választása, 2026-10-05): fölül
                  a Franchise és a Saját értékelés egymás mellett, alatta keretes sáv: Állapot |
                  Letöltve | Mama; sorozatnál az Évadok a sáv fölött, a sávban csak a Mama */}
              <div className="editor-pair">
                <div className="field">
                  <span aria-hidden="true">Franchise</span>
                  <FranchiseSelect
                    label="Franchise"
                    value={form.franchise_id}
                    franchises={franchises}
                    onChange={(id) => setField('franchise_id', id)}
                    onCreate={onCreateFranchise}
                    onDelete={onDeleteFranchise}
                    onRename={onRenameFranchise}
                  />
                </div>
                <div className="field">
                  <span>Saját értékelés</span>
                  <div className="rating-field">
                    <StarRating
                      name="editor-rating"
                      label="Saját értékelés"
                      value={form.my_rating}
                      onChange={(n) => setField('my_rating', n)}
                    />
                    <span className="rating-number">
                      {form.my_rating ? `${form.my_rating}/10` : 'Nincs'}
                    </span>
                    {form.my_rating && (
                      <button
                        type="button"
                        className="link small"
                        onClick={() => setField('my_rating', null)}
                      >
                        Törlés
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {seasonal && (
                <fieldset className="field">
                  <legend>Évadok</legend>
                  <p className="muted small season-hint">Az évadok változása azonnal mentődik.</p>
                  <SeasonTimeline title={t} onPick={pickSeason} />
                  <SeasonList title={t} actions={seasonActions} />
                </fieldset>
              )}

              <div className="editor-controls">
                {!seasonal && (
                  <>
                    <fieldset className="field">
                      <legend>Állapot</legend>
                      {/* az (üres) alapállapotnak nincs gombja: egyik sincs kiválasztva; az
                          "Abbahagyva" csak sorozatnál */}
                      <ClearableChips
                        name="status"
                        options={statuses.filter(
                          (s) =>
                            s.code !== DEFAULT_STATUS &&
                            (s.code !== DROPPED_STATUS || t.media_type === 'tv' || t.status === s.code)
                        )}
                        value={form.status}
                        onChange={changeStatus}
                      />
                    </fieldset>

                    <fieldset className="field downloaded-field">
                      <legend>Letöltés</legend>
                      {/* egyetlen gomb, mint az Állapotnál: újra kattintva kikapcsol ("nem
                          letöltött" gomb nincs – Norbi kérése, 2026-10-08) */}
                      <ClearableChips
                        name="is_downloaded"
                        options={DOWNLOADED_OPTIONS}
                        value={form.is_downloaded ? 'yes' : null}
                        onChange={(code) => setField('is_downloaded', code === 'yes')}
                      />
                    </fieldset>
                  </>
                )}
                <fieldset className="field">
                  <legend>Mama</legend>
                  {/* saját jelölés: kiválasztva a második kiemelőszínnel (borostyán) */}
                  <ClearableChips
                    name="mama_status"
                    className="mama-chips"
                    options={MAMA_OPTIONS}
                    value={form.mama_status}
                    onChange={(code) => setField('mama_status', code)}
                  />
                </fieldset>
              </div>
            </Lock>
          )}

          {/* a TMDB ajánlásai: egy kattintással a listára, a borítóra kattintva az adatlapjuk */}
          <SimilarTitles title={t} existingKeys={existingKeys} onAdded={onAdded} onPreview={onPreview} readOnly={readOnly} />

          {!preview && errorMessage}

          <div className="editor-actions">
            {preview ? (
              <>
                <span className="spacer" />
                <button type="button" className="ghost" onClick={close}>
                  Bezárás
                </button>
              </>
            ) : readOnly ? (
              // net nélkül (terv-3 44) csak nézni lehet
              <>
                <span className="muted small">Kapcsolat nélkül csak nézelődni lehet.</span>
                <span className="spacer" />
                <button type="button" className="ghost" onClick={close}>
                  Bezárás
                </button>
              </>
            ) : confirmingDelete ? (
              <>
                <span className="confirm-text">Biztosan törlöd a listádról?</span>
                <span className="spacer" />
                <button type="button" className="ghost" autoFocus onClick={cancelDelete}>
                  Mégse
                </button>
                <button type="button" className="danger" disabled={busy} onClick={handleDelete}>
                  {busy ? 'Törlés…' : 'Igen, törlés'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="danger-link"
                  ref={deleteButtonRef}
                  disabled={busy}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Törlés a listáról
                </button>
                <span className="spacer" />
                {/* mindig a lapon van (üresen is), hogy a felolvasó bemondja, amikor megtelik */}
                <span className="unsaved-hint" role="status">
                  {nudged && dirty ? 'Mentetlen módosítás – Mentés vagy Mégse' : ''}
                </span>
                <button type="button" className="ghost" onClick={close}>
                  Mégse
                </button>
                <button type="submit" className={attention ? 'primary attention' : 'primary'} disabled={busy}>
                  {busy ? 'Mentés…' : 'Mentés'}
                </button>
              </>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
