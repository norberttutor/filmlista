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
  DETAILS_V,
  CREDITS_V,
  mamaApplies,
  mamaLabel,
  refreshTitleDetails,
  formatRuntime,
  seriesStatusText,
} from '@/lib/titles';
import { saveRow } from '@/lib/rowSaves';
import StarRating from '@/components/StarRating';
import FranchiseSelect from '@/components/FranchiseSelect';
import { Lock } from '@/components/TitleTable';
import ImdbBadge, { CriticBadges } from '@/components/ImdbBadge';
import ReleaseBadge from '@/components/ReleaseBadge';
import WatchProviders from '@/components/WatchProviders';
import TopCast from '@/components/TopCast';
import PersonPage from '@/components/PersonPage';
import { hasSeasons, SeasonList, SeasonTimeline, useSeasonActions } from '@/components/Seasons';
import SimilarTitles from '@/components/SimilarTitles';
import { usePosterColor, ambientProps } from '@/lib/posterColor';
import { canMorph, MORPH_NAME, afterTransition } from '@/lib/viewTransition';
import { nudgeDialog, useBackdropClose } from '@/lib/useBackdropClose';
import { TrailerButton, TrailerPlayer } from '@/components/Trailer';
import { pushDialogPage, popDialogPage } from '@/lib/backClose';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useTheme } from '@/lib/theme';
import { useOnline } from '@/lib/offline';
import { galleryList, GalleryStrip, BackdropPager, GalleryLightbox } from '@/components/TitleGallery';
import DialogClose from '@/components/DialogClose';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w500'; // a nagy borító (asztalon)
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/'; // a háttérkép (telefonon w780, asztalon w1280)
const PHONE_QUERY = '(max-width: 640px)';
const WIDE_QUERY = '(min-width: 900px)'; // a kétoszlopos asztali adatlap (app/styles/*adatlap*.css)

// Rádiógombok "chip" formában; a kiválasztottra újra kattintva visszaáll üresre.
const DOWNLOADED_OPTIONS = [{ code: 'yes', name: 'Letöltve' }];

// flash: épp mentődött (terv-3 79, „B”) – a kiválasztott gomb sarkán egy pillanatra türkiz pipa
function ClearableChips({ name, options, value, onChange, className, flash }) {
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
          {flash && value === o.code && <SavedCheck key={flash} className="on-chip" />}
        </label>
      ))}
    </div>
  );
}

// „Mentve” jelzés (terv-3 79): kis türkiz pipa, 2 mp után elhalványul (a felolvasónak a lap alján
// lévő „… – mentve” sor szól)
function SavedCheck({ className }) {
  return (
    <i className={className ? `saved-check ${className}` : 'saved-check'} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </i>
  );
}

// Felugró ablak egy cím adatlapjával. A listán lévő címnél a saját adatai szerkeszthetők és a
// cím törölhető; a még nem listán lévőnél (a Cím hozzáadása találatai, a Felfedezés, a Hasonló
// címek) előnézet: ugyanaz az adatlap a TMDB-ről, a szerkesztő mezők helyett egy „Hozzáadás a
// listához” gombbal – felvétel után a lap helyben a rendes adatlapra vált (Norbi döntése).
// Az ablakban több adatlap lehet egymás mögött: a Hasonló címek borítójára kattintva a hasonló
// cím kerül előre, a „Vissza” az előzőre lép (az elhagyott lap rejtve megmarad, a görgetési
// helyével együtt). A Szereplők nevére kattintva a színész lapja kerül előre (PersonPage, terv-3 61).
// A natív <dialog> elemet használja: Esc-re bezárul, a fókusz az ablakban
// marad; asztalon a háttérre kattintva is bezárul. A listán lévő cím mezői azonnal mentődnek (terv-3 79).
export default function TitleEditor({
  title: opened, // a megnyitott cím: a lista sora, vagy egy TMDB-találat (előnézet)
  titles, // a lista: a lapok mindig a friss sort mutatják, és innen tudják, mi van már a listán
  morphTo, // a borító, amelyről nyílt: bezáráskor oda siklik vissza (nézetváltás)
  onClose,
  ...pageProps
}) {
  const dialogRef = useRef(null);
  const pageRef = useRef(null); // az elöl lévő lap: { canLeave() }
  const nextId = useRef(1);
  const closeRef = useRef(null); // a mostani close (az Esc-figyelőnek)
  const scrolls = useRef(new Map()); // lap → görgetési hely (a „Vissza” ide tér vissza)
  // a megnyitott adatlapok, az utolsó látszik; added: előnézetből most került a listára
  // (opened.person: a személy lapjával nyílik – a „Cím hozzáadása” keresőből, terv-3 110)
  const [stack, setStack] = useState(() => [
    opened.person ? { id: 0, person: opened.person, added: false } : { id: 0, rowId: opened.id ?? null, item: opened, added: false },
  ]);

  // a lap sora a listából: a listáról nyitottnál azonosító szerint (ha közben lekerült – törlés –,
  // a megnyitáskori), a többinél a TMDB-azonosító szerint (null: nincs a listán → előnézet); a
  // színész lapjának (person) nincs sora
  function rowOf(entry) {
    if (entry.person) return null;
    if (entry.rowId != null) return titles.find((x) => x.id === entry.rowId) ?? entry.item;
    const { media_type, tmdb_id } = entry.item;
    return titles.find((x) => x.media_type === media_type && x.tmdb_id === tmdb_id) ?? null;
  }
  const pages = stack.map((entry) => ({ ...entry, row: rowOf(entry) }));
  const top = pages[pages.length - 1];
  const topPreview = !top.row;
  // a borító hangulatszíne: az ablak a film színében dereng (app/styles/33-hangulatszin.css); a
  // színész lapja a legutóbbi film színét tartja (a keresőből nyílt személy lapja előtt nincs film)
  const film = pages.findLast((page) => !page.person);
  const ambient = usePosterColor(film ? (film.row ?? film.item).poster_path : null);

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

  // Asztalon az ablakon kívülre (a sötét háttérre) kattintva bezárul – Norbi kérése. Nyitva marad, ha
  // épp a törlést erősítenéd meg, vagy a Franchise mezőben új nevet / átnevezést gépelsz, vagy
  // épp felveszed a címet (lib/useBackdropClose: a kifelé húzott kijelölés sem zár, telefonon –
  // alsó lap – a lehúzás zár). Az Esc továbbra is mindig bezárja (onCancel).
  const closing = { onClose: close, canClose: () => pageRef.current?.canLeave() ?? true };
  const backdrop = useBackdropClose(dialogRef, closing);

  // lapváltás előtt: törlés-megerősítés, franchise-név gépelése, felvétel közben a lap nem hagyható el
  // (mint a kikattintásnál)
  function canLeavePage() {
    const page = pageRef.current;
    if (!page || page.canLeave()) return true;
    nudgeDialog(dialogRef.current); // az ablak megbillen (átnézés J14)
    return false;
  }

  // a Hasonló címek borítója: a cím adatlapja kerül előre (a listán lévőé szerkeszthető)
  function openPreview(item) {
    if (!canLeavePage()) return;
    scrolls.current.set(top.id, dialogRef.current.scrollTop);
    const id = nextId.current++;
    setStack((s) => [...s, { id, rowId: null, item, added: false }]);
    pushDialogPage(dialogRef.current);
  }

  // a Szereplők neve: a színész lapja kerül előre (terv-3 61)
  function openPerson(person) {
    if (!canLeavePage()) return;
    scrolls.current.set(top.id, dialogRef.current.scrollTop);
    const id = nextId.current++;
    setStack((s) => [...s, { id, person, added: false }]);
    pushDialogPage(dialogRef.current);
  }

  // fromHistory: a böngésző Vissza-lépése – a lap bejegyzése már lekerült
  function goBack(fromHistory = false) {
    if (!canLeavePage()) return false;
    setStack((s) => s.slice(0, -1));
    if (!fromHistory) popDialogPage(dialogRef.current);
    return true;
  }

  // a böngésző / telefon Vissza gombja (terv-3 62, lib/backClose.js): előbb a lapokat lépteti vissza (mint
  // a „‹ Vissza” – a lapok saját előzmény-bejegyzést kapnak), különben bezár (mint az Esc); ha a lap épp nem
  // hagyható el (pl. törlés-megerősítés), nyitva marad
  useEffect(() => {
    dialogRef.current.backHandler = () => {
      if (stack.length > 1) return goBack(true) ? 'stepped' : 'stay';
      if (!canLeavePage()) return 'stay';
      close();
      return 'closing';
    };
    closeRef.current = close;
  });

  // Esc (a dialog closedby="none", magától nem zár): a saját bezárás, nézetváltással. Az egész lapon
  // figyeli – ha az elöl lévő gomb eltűnt (pl. „Visszavonás”), a fókusz a lapra kerül –, de másik
  // ablakból nem; a belső mezők (pl. a franchise új neve) a saját Esc-jüket preventDefault-tal jelzik.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const t = e.target;
      if (t !== document.body && t !== document.documentElement && !dialogRef.current?.contains(t)) return;
      e.preventDefault();
      closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // watched: „Már láttam”-mal került fel (terv-3 80) – a lap a csillagokra hívja fel a figyelmet
  function markAdded(id, watched = false) {
    setStack((s) => s.map((entry) => (entry.id === id ? { ...entry, added: watched ? 'watched' : true } : entry)));
  }

  return (
    <dialog
      ref={dialogRef}
      className="editor title-editor"
      aria-labelledby="editor-title"
      onClose={onClose}
      // A böngésző magától nem zárja (closedby): Androidon nyitott ablaknál a vissza-gesztus különben az
      // ablakhoz jutna (Esc-szerű bezárási kérésként – a megállítását a Chrome korlátozza), így viszont az
      // előzményekhez, ahol a lapokat lépteti (lib/backClose.js). Az Esc-et a keydown kezeli.
      closedby="none"
      onCancel={(e) => {
        // closedby nélküli (régebbi) böngészőben a vissza-gesztus ide jut: a Vissza szabálya szerint
        if (!e.cancelable) return;
        e.preventDefault();
        if (stack.length > 1) goBack();
        else if (canLeavePage()) close();
      }}
      {...backdrop}
      {...ambientProps(ambient)}
    >
      {/* asztalon „Bezárás” a jobb felső sarokban, görgetéskor is látszik (terv-3 121); telefonon fogantyú – lefelé
          húzva zár (az Esc / Vissza ugyanaz). Mint a kikattintás: törlés-megerősítés / felvétel közben nem zár */}
      <DialogClose dialogRef={dialogRef} {...closing} />
      {pages.map((page, i) => {
        const active = i === pages.length - 1;
        const prev = pages[i - 1];
        const back = prev ? (prev.person?.name ?? (prev.row ?? prev.item).title) : null;
        if (page.person) {
          return (
            <PersonPage
              key={`${page.id}:person`}
              person={page.person}
              titles={titles}
              active={active}
              apiRef={active ? pageRef : null}
              back={back}
              onBack={() => goBack()}
              onPreview={openPreview}
              onAdded={pageProps.onAdded}
              readOnly={pageProps.readOnly}
            />
          );
        }
        return (
          // felvételkor (előnézet → sor) új lap: a szerkesztő mezők a friss sorból indulnak
          <TitlePage
            key={`${page.id}:${page.row ? 'row' : 'preview'}`}
            entry={page}
            active={active}
            apiRef={active ? pageRef : null}
            back={back}
            onBack={() => goBack()}
            onPreview={openPreview}
            onPerson={openPerson}
            onAddedHere={(watched) => markAdded(page.id, watched)}
            closeNow={() => dialogRef.current.close()}
            {...pageProps}
          />
        );
      })}
    </dialog>
  );
}

// Egy adatlap az ablakban: listán lévő címnél (entry.row) szerkeszthető, különben előnézet.
// Sorozatnál az állapot és a "Letöltve" helyett az évadlista látszik. Minden mező azonnal mentődik
// (onChanged; terv-3 79, „B”).
function TitlePage({
  entry,
  active, // ez látszik (a többi rejtve, az ablakban hátrébb)
  apiRef, // az elöl lévő lapé: az ablak ezen kérdezi, elhagyható-e
  back, // az előző lap címe („Vissza: …”), vagy null
  onBack,
  onPreview,
  onPerson, // a Szereplők neve: a színész lapja (terv-3 61)
  onAddedHere,
  closeNow, // azonnal (törléskor: nincs hova visszasiklani)
  statuses,
  franchises,
  onCreateFranchise,
  onDeleteFranchise,
  onRenameFranchise,
  existingKeys,
  onAdded,
  onChanged,
  onDelete,
  readOnly, // net nélkül (terv-3 44): csak nézni lehet
}) {
  const row = entry.row;
  const preview = !row;
  const online = useOnline(); // a csak olvasható mód oka (S10): nincs net, vagy a lista még nem frissült
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
    apiGet('/api/tmdb/details', { type: media_type, id: tmdb_id, v: DETAILS_V }, { signal: controller.signal })
      .then((data) => afterTransition().then(() => !controller.signal.aborted && setDetails(data)))
      .catch((err) => err.name !== 'AbortError' && setDetailsError(err.message));
    return () => controller.abort();
  }, [preview, media_type, tmdb_id]);
  const t = row ?? { ...entry.item, ...details };

  const [busy, setBusy] = useState(false); // előnézet: a felvétel alatt
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const seasonal = hasSeasons(t);
  // Mama-csoport csak franchise nélküli filmnél (terv-3 58) – a franchise átállításakor azonnal; a már
  // meglévő érték mellett marad, hogy törölhető legyen
  const showMama = mamaApplies(t);
  // azonnali mentés (terv-3 79, „B”): a módosítás rögtön mentődik (optimista – lib/rowSaves.js), a
  // módosított vezérlőn egy pillanatra pipa (flash: { field, id }), a gombsor fölött „… – mentve ·
  // Visszavonás” (undos: a módosítások előtti értékek, a legutóbbi a végén – lépésenként visszafelé;
  // 10 mp után a sor eltűnik, a lista ürül)
  const [flash, setFlash] = useState(null);
  const [undos, setUndos] = useState([]);
  const saveId = useRef(0);
  const flashTimer = useRef(0);
  const undoTimer = useRef(0);
  useEffect(() => () => (clearTimeout(flashTimer.current), clearTimeout(undoTimer.current), clearTimeout(tmdbTimer.current)), []);
  // „Frissítés a TMDB-ről” (terv-3 83): null | 'busy' | 'changed' | 'same' (az utóbbi kettő 4 mp-ig látszik)
  const [tmdbRefresh, setTmdbRefresh] = useState(null);
  const tmdbTimer = useRef(0);
  const seasonActions = useSeasonActions(t, onChanged, setError);
  // előzetes a TMDB-ről (magyar, ha nincs: angol): megnyitáskor a háttérben kérdezzük le; a gomb
  // csak akkor jelenik meg, ha van. A lejátszó csak kattintásra töltődik (YouTube, adatkímélő mód).
  // A háttérben érkező adatok a megnyitás mozgásának végét megvárják (afterTransition).
  const [trailer, setTrailer] = useState(null);
  const [playing, setPlaying] = useState(false);
  // a képgaléria nagy nézete (terv-3 95): a kép indexe, vagy null – itt, mert az elhagyott lap (lent) zárja
  const [zoom, setZoom] = useState(null);
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
    if (!active) {
      setPlaying(false);
      setZoom(null);
    }
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

  // képgaléria (terv-3 95): a cím jelenetképei, szintén a háttérben, a mozgás után. Asztalon „Képek” sor (A),
  // telefonon (≤ 640 px, ha van jelenetkép) a fejléc képe lapozható (B); rákattintva nagy nézet (zoom: index)
  const [images, setImages] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    apiGet('/api/tmdb/images', { type: t.media_type, id: t.tmdb_id }, { signal: controller.signal })
      .then((data) => afterTransition().then(() => !controller.signal.aborted && setImages(data.images)))
      .catch((err) => err.name !== 'AbortError' && console.warn('Képek:', err.message));
    return () => controller.abort();
  }, [t.media_type, t.tmdb_id]);
  const gallery = galleryList(t.backdrop_path, images);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const pager = isPhone && Boolean(t.backdrop_path) && gallery.length > 1;
  const [shown, setShown] = useState(0); // B: a fejléc éppen látható képe
  const backdropPath = pager ? gallery[Math.min(shown, gallery.length - 1)] : t.backdrop_path;

  // moziszerű fejléc (terv-3 104, 2026-10-15): asztalon (≥ 900 px) a jelenetképes lapon a kép magasabb, a borító
  // kicsiben, a cím nagyban, az adatok, a leírás és az előzetes gombja a képre kerül; a bal oszlopban csak a „Hol
  // nézhető?” és a Szereplők marad. A leírás a képen 3 sorban, „Tovább” csak ha nem fér el.
  const hero = useMediaQuery(WIDE_QUERY) && Boolean(t.backdrop_path);
  const teka = useTheme() === 'teka';
  // a fejléc ilyenkor máshová kerül a JSX-ben (a képre / a jobb oszlop tetejére), a cím újraépül: ha az előnézet
  // jelenetképe a megnyitás után érkezik, a címen lévő fókusz a body-ra esne – visszakerül a címre
  const heroSeen = useRef(hero);
  useLayoutEffect(() => {
    if (heroSeen.current === hero) return;
    heroSeen.current = hero;
    if (active && (document.activeElement == null || document.activeElement === document.body)) {
      pageEl.current?.querySelector('h2')?.focus({ preventScroll: true });
    }
  }, [hero, active]);
  const overviewRef = useRef(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [overviewLong, setOverviewLong] = useState(false);
  // a „Tovább” előtti helyzet: kinyitva a jelenetkép ekkora marad (nem nagyítódik fel, nem vágódik le), a cím és a
  // kisebb borító sem mozdul – a hosszabb leírás csak lefelé nő, a kép alatt a sima háttérre
  const [heroFrozen, setHeroFrozen] = useState(null);
  function toggleOverview() {
    const box = overviewRef.current?.closest('.editor-backdrop');
    const head = box?.querySelector('header');
    const poster = head?.querySelector('.editor-hero-poster');
    // tört képpontokkal (az offsetTop kerekít – egy picit ugrana)
    const top = (el) => el.getBoundingClientRect().top;
    setHeroFrozen(
      overviewOpen || !head
        ? null
        : {
            '--hero-img-h': box.getBoundingClientRect().height + 'px',
            '--hero-head-top': top(head) - top(box) + 'px',
            ...(poster && { '--hero-poster-top': top(poster) - top(head) + 'px' }),
          }
    );
    setOverviewOpen((o) => !o);
  }
  // megnyitáskor az ablak még nem látszik (a showModal a szülő effektjében fut): a méret változásakor is mér
  useLayoutEffect(() => {
    const el = overviewRef.current;
    if (!el || !hero || overviewOpen) return;
    const measure = () => setOverviewLong(el.scrollHeight > el.clientHeight + 2);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [t.overview, hero, overviewOpen]);

  // szereplők (terv-3 38): a top cast első 3 tagja, szintén a háttérben, a mozgás után
  // filmnél a rendező is (M4 – a nevére kattintva a lapja, követhető)
  const [cast, setCast] = useState(null);
  const [directors, setDirectors] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    apiGet('/api/tmdb/credits', { type: t.media_type, id: t.tmdb_id, v: CREDITS_V }, { signal: controller.signal })
      .then((data) =>
        afterTransition().then(() => {
          if (controller.signal.aborted) return;
          setCast(data.cast);
          setDirectors(data.directors ?? []);
        })
      )
      .catch((err) => err.name !== 'AbortError' && console.warn('Szereplők:', err.message));
    return () => controller.abort();
  }, [t.media_type, t.tmdb_id]);

  // nyitva marad az ablak (kikattintásra, lapváltáskor), ha épp a törlést erősítenéd meg, a
  // Franchise mezőben új nevet / átnevezést gépelsz, vagy felveszed a címet (mentetlen módosítás
  // nincs – minden azonnal mentődik). Net nélkül a megerősítés / névmező „Mégse” gombja rejtett vagy
  // tiltott, és úgysem menthető – ilyenkor elhagyható (különben telefonon nem lehetne bezárni).
  useImperativeHandle(apiRef, () => ({
    canLeave: () =>
      !busy && (readOnly || (!confirmingDelete && !pageEl.current?.querySelector('.franchise-new'))),
  }));

  // az idővonal pöttyére kattintva a lista az évadhoz görget, és annak első gombja kapja a fókuszt
  function pickSeason(n) {
    const seasonRow = pageEl.current?.querySelector(`.season-list li[data-season="${n}"]`);
    seasonRow?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    seasonRow?.querySelector('input')?.focus({ preventScroll: true });
  }

  // egy módosítás mentése: field – melyik vezérlő kapja a pipát; label – a „… – mentve” sor szövege;
  // undo: false a visszavonásnál (az nem kerül a visszavonható lépések közé)
  async function save(field, changes, label, undo = true) {
    if (readOnly) return;
    const before = Object.fromEntries(Object.keys(changes).map((k) => [k, t[k] ?? null]));
    const apply = (r) => ({
      ...r,
      ...changes,
      ...(changes.status && { status_name: statuses.find((s) => s.code === changes.status)?.name ?? r.status_name }),
    });
    const id = ++saveId.current;
    setError('');
    clearTimeout(flashTimer.current);
    setFlash({ field, id });
    flashTimer.current = setTimeout(() => setFlash(null), 2100);
    clearTimeout(undoTimer.current);
    if (undo) setUndos((u) => [...u, { id, field, label, before }]);
    undoTimer.current = setTimeout(() => setUndos([]), 10000);
    try {
      await saveRow(t, apply, () => updateTitle(t.id, changes), onChanged);
    } catch (err) {
      setError(err.message);
      setFlash((f) => (f?.id === id ? null : f));
      setUndos((u) => u.filter((x) => x.id !== id));
    }
  }

  // a cím TMDB-adatainak frissítése kézzel (magyar cím – ha még az eredeti áll ott –, leírás, borító, műfajok)
  async function refreshFromTmdb() {
    clearTimeout(tmdbTimer.current);
    setTmdbRefresh('busy');
    setError('');
    try {
      const { row: fresh, changed, gone } = await refreshTitleDetails(t.id);
      if (fresh) onChanged(fresh);
      if (gone) {
        // átnézés H10: ne „Nincs újdonság” legyen, ha a TMDB-n már nincs meg
        setTmdbRefresh(null);
        setError('Ez a cím már nincs meg a TMDB-n, ezért az adatai nem frissíthetők.');
        return;
      }
      setTmdbRefresh(changed ? 'changed' : 'same');
      tmdbTimer.current = setTimeout(() => setTmdbRefresh(null), 4000);
    } catch (err) {
      setTmdbRefresh(null);
      setError(err.message);
    }
  }

  // a legutóbbi módosítás visszavonása (a következő Visszavonás az előzőt)
  function undoLast() {
    const last = undos[undos.length - 1];
    if (!last) return;
    setUndos((u) => u.slice(0, -1));
    save(last.field, last.before, null, false);
  }

  function changeStatus(code) {
    code ??= DEFAULT_STATUS; // a kiválasztott újra kattintva: vissza az (üres) alapállapotba
    const becomesWatched = code === 'watched' && t.status !== 'watched';
    const name = statuses.find((s) => s.code === code)?.name;
    save(
      'status',
      {
        status: code,
        // megnézettre állításkor a mai nap (a felületen nem látszik, nem szerkeszthető – Norbi
        // kérése; a Statisztika és a CSV-mentés használja)
        watched_at: code === 'watched' ? (t.watched_at ?? todayDate()) : null,
        // ...és a "Letöltve" törlődik (az adatbázis-trigger szabálya, itt azonnal látszik)
        ...(becomesWatched && { is_downloaded: false }),
      },
      code === DEFAULT_STATUS ? 'Állapot törölve' : `Állapot: ${name}`
    );
  }

  const changeDownloaded = (on) =>
    save('is_downloaded', { is_downloaded: on }, on ? 'Letöltve' : 'Letöltve jelölés levéve');
  const changeRating = (n) =>
    save('my_rating', { my_rating: n }, n ? `Saját értékelés: ${n}/10` : 'Saját értékelés törölve');
  const changeMama = (code) =>
    save('mama_status', { mama_status: code }, code ? `Mama: ${mamaLabel(code)}` : 'Mama-jelölés törölve');
  // a lenyíló „Új franchise” / „Törlés” művelete után is onChange jön: a most létrehozott neve még
  // nincs a franchises-ban, a törölt pedig már minden címről lekerült (nincs mit menteni, visszavonni)
  const created = useRef(null);
  const deleted = useRef(null);
  function changeFranchise(id) {
    if (id == null && deleted.current != null && deleted.current === t.franchise_id) return;
    if ((id ?? null) === (t.franchise_id ?? null)) return;
    const name = franchises.find((f) => f.id === id)?.name ?? (created.current?.id === id ? created.current.name : '');
    save('franchise_id', { franchise_id: id ?? null }, id ? `Franchise: ${name}` : 'Franchise törölve');
  }

  function cancelDelete() {
    flushSync(() => setConfirmingDelete(false));
    deleteButtonRef.current.focus();
  }

  // előnézet: felvétel a listára (a már lekérdezett adatokkal); utána a lap a rendes adatlapra
  // vált (az ablak új lapot rajzol a friss sorral)
  // watched: „Már láttam” (terv-3 80) – megnézettként kerül fel
  async function handleAdd(watched = false) {
    setBusy(watched ? 'watched' : 'add');
    setError('');
    try {
      const added = await addTitle(entry.item, details, { watched });
      onAddedHere(watched);
      onAdded(added);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  // a form csak az előnézet felvétele (a listán lévő cím mezői azonnal mentődnek – terv-3 79)
  function handleSubmit(event) {
    event.preventDefault();
    if (!readOnly && preview) handleAdd();
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

  const player = <TrailerPlayer trailer={trailer} playing={playing} title={t.title} />;
  const statusText = seriesStatusText(t);
  const runtime = formatRuntime(t);

  // a cím, a borító és az adatok: asztalon (≥ 900 px) a jelenetképes lapon a képen (terv-3 104, moziszerű fejléc),
  // különben a jobb oszlop tetején
  const header = (
    <header>
      {/* keskenyebben (< 900 px), jelenetképes lapon a borító balra a kép aljára úszik, mellette a
          cím és az adatok (terv-3 72, „A”); asztalon a burkolók display: contents – nem változik semmi */}
      <div className="editor-titlebar">
        {t.backdrop_path && t.poster_path && (
          <img className="editor-hero-poster" src={POSTER_BASE + t.poster_path} alt="" decoding="async" />
        )}
        <div className="editor-titletext">
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
            {/* sorozatnál az állapota szavakkal, a megjelent évadok számával (terv-3 125, „D”) – ha ismert,
                az előnézet külön évadszáma helyett */}
            {statusText ? (
              <span>{statusText}</span>
            ) : (
              preview && t.seasons?.length > 0 && <span>{t.seasons.length} évad</span>
            )}
            {runtime && <span title={runtime.tooltip}>{runtime.text}</span>}
            <ImdbBadge title={t} />
            <CriticBadges title={t} />
            {/* előnézetnél csak a TMDB-adatokkal (a találatban nincs megjelenési dátum) */}
            {(!preview || details) && <ReleaseBadge state={releaseState(t)} />}
          </p>
          {/* műfajok, pötty nélkül (mint Mama adatlapján; Norbi kérése, 2026-10-08) – előnézetnél a
              TMDB-adatokból ({ id, name }), amint megjöttek. A cím szövegoszlopában: keskenyebben (< 900 px) így
              a borító mellett, a cím adatai alatt marad – korábban a borító alá csúszott, a „Hol nézhető?” fölé
              (átnézés K5, 2026-10-16); asztalon a burkoló display: contents, ott nem változik semmi */}
          {t.genres?.length > 0 && (
            <p className="editor-genres">{t.genres.map((g) => (typeof g === 'string' ? g : g.name)).join(' · ')}</p>
          )}
        </div>
      </div>
      {entry.added && (
        <p className="added-note" role="status">
          {entry.added === 'watched'
            ? '✓ Felkerült a listádra megnézettként – hogy tetszett? Alább megadhatod a csillagokat.'
            : '✓ Felkerült a listádra – itt beállíthatod az állapotát és az értékelését.'}
        </p>
      )}
      {/* keskenyebben (< 900 px, nincs nagy borító) itt, az előzetes fölött */}
      <WatchProviders providers={providers} className="inline" />
      <TrailerButton trailer={trailer} playing={playing} onToggle={() => setPlaying((p) => !p)} />
      {!hero && player}
      {t.overview ? (
        <>
          <p ref={overviewRef} className={hero && !overviewOpen ? 'editor-overview clamped' : 'editor-overview'}>
            {t.overview}
          </p>
          {hero && (overviewLong || overviewOpen) && (
            <button type="button" className="link small overview-more" aria-expanded={overviewOpen} onClick={toggleOverview}>
              {overviewOpen ? 'Kevesebb' : 'Tovább'}
            </button>
          )}
        </>
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
      <TopCast cast={cast} directors={directors} variant="inline" onPerson={onPerson} />
    </header>
  );

  return (
    <div ref={pageEl} className={`editor-page${t.backdrop_path ? ' has-backdrop' : ''}${hero ? ' has-hero' : ''}`} hidden={!active}>
      {/* a film széles jelenetképe az ablak tetején (TMDB); asztalon rajta a fejléc (terv-3 104) */}
      {t.backdrop_path && (
        <div
          className="editor-backdrop"
          data-pager={pager ? '' : undefined}
          data-frozen={hero && overviewOpen && heroFrozen ? '' : undefined}
          style={hero && overviewOpen && heroFrozen ? heroFrozen : undefined}
        >
          <img
            src={BACKDROP_BASE + 'w1280' + backdropPath}
            srcSet={`${BACKDROP_BASE}w780${backdropPath} 780w, ${BACKDROP_BASE}w1280${backdropPath} 1280w`}
            sizes="(max-width: 640px) 100vw, 60rem"
            alt=""
            aria-hidden="true"
            decoding="async"
          />
          {/* videotéka-téma (D10): a videomagnó képernyőfelirata a kép sarkában */}
          {teka && (
            <span className="teka-play" aria-hidden="true">
              ▶ PLAY <span>SP</span>
            </span>
          )}
          {/* telefonon a fejléc képe lapozható (terv-3 95, „B”) */}
          {pager && <BackdropPager count={gallery.length} index={Math.min(shown, gallery.length - 1)} onIndex={setShown} onOpen={setZoom} />}
          {hero && header}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        {/* asztalon a borító nagyban, balra (görgetéskor a helyén marad), alatta a „Hol
            nézhető?”; keskenyebben (< 900 px) rejtve. A moziszerű fejlécnél a borító a képen van. */}
        <div className="editor-side">
          {!hero && (
            <div className="editor-poster" aria-hidden="true">
              {t.poster_path && <img src={POSTER_BASE + t.poster_path} alt="" decoding="async" />}
            </div>
          )}
          <WatchProviders providers={providers} className="side" />
          <TopCast cast={cast} directors={directors} variant="side" onPerson={onPerson} />
        </div>
        <div className="editor-main">
          {!hero && header}
          {hero && player}

          {preview ? (
            // előnézet: a szerkesztő mezők helyett egyetlen gomb
            <div className="preview-add">
              <div className="preview-add-buttons">
                <button type="submit" className="primary" disabled={Boolean(busy) || readOnly}>
                  {busy === 'add' ? 'Hozzáadás…' : 'Hozzáadás a listához'}
                </button>
                {/* már látott cím: megnézettként kerül fel (terv-3 80) */}
                <button type="button" className="ghost" disabled={Boolean(busy) || readOnly} onClick={() => handleAdd(true)}>
                  {busy === 'watched' ? 'Hozzáadás…' : 'Már láttam'}
                </button>
              </div>
              <p className="muted small">Felvétel után itt beállíthatod az állapotát és az értékelését is.</p>
              {detailsError && (
                <p className="error small" role="alert">
                  {detailsError}
                </p>
              )}
              {errorMessage}
            </div>
          ) : (
            <>
            {/* net nélkül (terv-3 44) csak nézni lehet: a mezők fölött szól (átnézés J3), nem csak a lap alján */}
            {readOnly && (
              <p className="readonly-note small" role="status">
                {online
                  ? 'A lista még nem frissült – addig csak nézelődni lehet.'
                  : 'Kapcsolat nélkül csak nézelődni lehet.'}
              </p>
            )}
            <Lock on={readOnly}>
              {/* tömör elrendezés (terv-3 30, B – „vezérlősáv”, Norbi választása, 2026-10-05): fölül
                  a Franchise és a Saját értékelés egymás mellett, alatta keretes sáv: Állapot |
                  Letöltve | Mama; sorozatnál az Évadok a sáv fölött (a Mama sorozatnál és
                  franchise-os címnél nincs – terv-3 58; ha így a sáv üres, el is marad) */}
              <div className="editor-pair">
                <div className="field">
                  <span aria-hidden="true">
                    Franchise{flash?.field === 'franchise_id' && <SavedCheck key={flash.id} />}
                  </span>
                  <FranchiseSelect
                    label="Franchise"
                    value={t.franchise_id ?? null}
                    franchises={franchises}
                    onChange={changeFranchise}
                    onCreate={async (name) => (created.current = await onCreateFranchise(name))}
                    onDelete={async (id) => {
                      deleted.current = id;
                      await onDeleteFranchise(id);
                    }}
                    onRename={onRenameFranchise}
                  />
                </div>
                <div className="field">
                  <span>
                    Saját értékelés{flash?.field === 'my_rating' && <SavedCheck key={flash.id} />}
                  </span>
                  <div className="rating-field">
                    <StarRating
                      name="editor-rating"
                      label="Saját értékelés"
                      value={t.my_rating ?? null}
                      onChange={changeRating}
                    />
                    <span className="rating-number">
                      {t.my_rating ? `${t.my_rating}/10` : 'Nincs'}
                    </span>
                    {t.my_rating && (
                      <button
                        type="button"
                        className="link small"
                        aria-label="Saját értékelés törlése"
                        onClick={() => changeRating(null)}
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
                  <SeasonTimeline title={t} onPick={pickSeason} />
                  <SeasonList title={t} actions={seasonActions} />
                </fieldset>
              )}

              {(!seasonal || showMama) && (
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
                          value={t.status}
                          onChange={changeStatus}
                          flash={flash?.field === 'status' && flash.id}
                        />
                      </fieldset>

                      <fieldset className="field downloaded-field">
                        <legend>Letöltés</legend>
                        {/* egyetlen gomb, mint az Állapotnál: újra kattintva kikapcsol ("nem
                            letöltött" gomb nincs – Norbi kérése, 2026-10-08) */}
                        <ClearableChips
                          name="is_downloaded"
                          options={DOWNLOADED_OPTIONS}
                          value={t.is_downloaded ? 'yes' : null}
                          onChange={(code) => changeDownloaded(code === 'yes')}
                          flash={flash?.field === 'is_downloaded' && flash.id}
                        />
                      </fieldset>
                    </>
                  )}
                  {showMama && (
                    <fieldset className="field">
                      <legend>Mama</legend>
                      {/* saját jelölés: kiválasztva a második kiemelőszínnel (borostyán) */}
                      <ClearableChips
                        name="mama_status"
                        className="mama-chips"
                        options={MAMA_OPTIONS}
                        value={t.mama_status ?? null}
                        onChange={changeMama}
                        flash={flash?.field === 'mama_status' && flash.id}
                      />
                    </fieldset>
                  )}
                </div>
              )}
            </Lock>
            </>
          )}

          {/* képgaléria (terv-3 95): asztalon (és jelenetkép nélkül telefonon is) „Képek” sor – „A” */}
          {!pager && gallery.length > 1 && <GalleryStrip images={gallery} onOpen={setZoom} />}

          {/* a TMDB ajánlásai: egy kattintással a listára, a borítóra kattintva az adatlapjuk */}
          <SimilarTitles title={t} existingKeys={existingKeys} onAdded={onAdded} onPreview={onPreview} readOnly={readOnly} />

          {!preview && errorMessage}

          {/* a legutóbbi módosítás: „Állapot: Megnézve – mentve · Visszavonás” (az ablak fölött az
              értesítősáv nem kattintható, ezért itt, a lapon); mindig a lapon (üresen is), hogy a
              felolvasó bemondja */}
          {!preview && (
            <p className="saved-note" role="status">
              {undos.length > 0 && (
                <>
                  <span>
                    <b>{undos[undos.length - 1].label}</b> – mentve
                  </span>
                  {/* net nélkül a visszavonás nem menthető – különben a lépés csendben elveszne (S13) */}
                  {!readOnly && (
                    <button type="button" className="link small" onClick={undoLast}>
                      Visszavonás
                    </button>
                  )}
                </>
              )}
            </p>
          )}

          {/* előnézetben és net nélkül (terv-3 44 – csak nézni lehet, a magyarázat a mezők fölött, J3) nincs gombsor;
              bezárni fent (DialogClose) */}
          {!preview && !readOnly && (
            <div className="editor-actions">
              {confirmingDelete ? (
                <>
                  <span className="confirm-text">Biztosan törlöd a listádról?</span>
                  <span className="spacer" />
                  <button type="button" className="ghost" autoFocus onClick={cancelDelete}>
                    Mégse
                  </button>
                  <button type="button" className="danger" disabled={busy} onClick={handleDelete}>
                    Törlés
                  </button>
                </>
              ) : (
                <>
                  {/* ikonos gombok (Norbi kérése, 2026-10-15 – korábban linkek): a törlés pirosas, a frissítés semleges */}
                  <button
                    type="button"
                    className="ghost editor-action danger-ghost"
                    ref={deleteButtonRef}
                    disabled={busy}
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                    </svg>
                    Törlés a listáról
                  </button>
                  <button
                    type="button"
                    className="ghost editor-action tmdb-refresh"
                    disabled={tmdbRefresh === 'busy'}
                    onClick={refreshFromTmdb}
                    title="A magyar cím (ha még az eredeti áll itt), a leírás, a borító és a műfajok a TMDB-ről"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5" />
                    </svg>
                    {tmdbRefresh === 'busy'
                      ? 'Frissítés…'
                      : tmdbRefresh === 'changed'
                        ? '✓ Frissítve'
                        : tmdbRefresh === 'same'
                          ? '✓ Nincs újdonság a TMDB-n'
                          : 'Frissítés a TMDB-ről'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </form>
      {/* nagy nézet (terv-3 95): a képsorról / a fejléc képéről */}
      {active && zoom != null && gallery.length > 0 && (
        <GalleryLightbox
          images={gallery}
          title={t.title}
          index={Math.min(zoom, gallery.length - 1)}
          onIndex={(i) => {
            setZoom(i);
            if (pager) setShown(i); // a fejléc képe is követi
          }}
          onClose={() => setZoom(null)}
        />
      )}
    </div>
  );
}
