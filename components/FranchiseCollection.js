'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { addTitle, setFranchiseCollections, todayDate, updateTitle } from '@/lib/titles';
import { useBackdropClose } from '@/lib/useBackdropClose';
import { usePosterColor, ambientProps, franchisePosterPath } from '@/lib/posterColor';
import WatchOrder from '@/components/WatchOrder';

const IMG = 'https://image.tmdb.org/t/p/';
const byYear = (a, b) => (a.release_year ?? 9999) - (b.release_year ?? 9999);

// A gyűjtemény-lekérés paraméterei: a franchise filmjei (TMDB-azonosító) és a kézzel
// hozzárendelt TMDB-gyűjtemények. A kulcs a lekérések gyorsítótárazásához (Franchise-ok ablak).
export function collectionParams(franchise, titles) {
  const movies = titles
    .filter((t) => t.franchise_id === franchise.id && t.media_type === 'movie')
    .map((t) => t.tmdb_id)
    .sort((a, b) => a - b)
    .join(',');
  return { movies, extra: (franchise.tmdb_collection_ids ?? []).join(',') };
}

export const paramsKey = (p) => `${p.movies}|${p.extra}`;

// A franchise TMDB-gyűjteményei a részekkel (/api/tmdb/collection); film és kézi gyűjtemény
// nélkül nincs mit lekérni.
export async function fetchCollections(params, signal) {
  if (!params.movies && !params.extra) return [];
  const data = await apiGet('/api/tmdb/collection', params, { signal });
  return data.collections;
}

// A gyűjtemények + a saját címek összesítése: szakaszok (a részeknél a franchise címe – own –, ill.
// a listán lévő, de nem ebbe a franchise-ba rendelt film – listed), a gyűjteményekben nem szereplő
// saját címek (extras), számok, hiányzók.
export function summarizeCollection(franchise, titles, collections) {
  const manual = franchise.tmdb_collection_ids ?? [];
  const own = titles.filter((t) => t.franchise_id === franchise.id);
  // a részek a listán: tmdb_id → cím (bármelyik franchise-ban vagy anélkül)
  const byTmdb = new Map(titles.filter((t) => t.media_type === 'movie').map((t) => [t.tmdb_id, t]));
  // csak a franchise-ba rendelt film számít a franchise-énak (a szűrés és a nézési sorrend is csak
  // ezeket mutatja); a listán lévő többi rész hozzárendelhető (Norbi jelezte, 2026-10-13: korábban
  // „A listán”-ként látszottak, mintha a franchise-ban lennének)
  const sections = collections.map((c) => ({
    ...c,
    manual: manual.includes(c.id),
    parts: c.parts.map((p) => {
      const t = byTmdb.get(p.tmdb_id) ?? null;
      const mine = t?.franchise_id === franchise.id;
      return { ...p, own: mine ? t : null, listed: t && !mine ? t : null };
    }),
  }));
  const inCollections = new Set(sections.flatMap((s) => s.parts.map((p) => p.tmdb_id)));
  const extras = own
    .filter((t) => !(t.media_type === 'movie' && inCollections.has(t.tmdb_id)))
    .sort(byYear);
  // számlálás: a gyűjtemények részei (egy film csak egyszer) + a további címek; a másik franchise-ban
  // lévő rész csak az összesbe számít
  const parts = [...new Map(sections.flatMap((s) => s.parts).map((p) => [p.tmdb_id, p])).values()];
  const total = parts.length + extras.length;
  const watched =
    parts.filter((p) => p.own?.status === 'watched').length + extras.filter((t) => t.status === 'watched').length;
  const onList = parts.filter((p) => p.own).length + extras.length;
  const missing = parts.filter((p) => !p.own && !p.listed).length;
  const unassigned = parts.filter((p) => p.listed && !p.listed.franchise_id).length;
  return { sections, extras, manual, counts: { total, watched, onList, missing, unassigned } };
}

// a számsor vége: „· 2 hiányzik · 1 nincs hozzárendelve” (a sávon, a csempén, a gyűjtemény-ablakban)
export function countsNote({ missing, unassigned }) {
  return `${missing > 0 ? ` · ${missing} hiányzik` : ''}${unassigned > 0 ? ` · ${unassigned} nincs hozzárendelve` : ''}`;
}

// Franchise-ra szűrve a lista fölött sáv: hány címét láttad / van a listán. A „Gyűjtemény”
// ablakban (gyűjteményenként egy szakasz):
// - a franchise filmjeinek összes TMDB-gyűjteménye (pl. Alien, Ragadozó, AVP, Prometheus) és a
//   kézzel hozzárendeltek (franchises.tmdb_collection_ids) – a részek megjelenési sorrendben, a
//   hiányzók egy kattintással felvehetők (a franchise is beállítódik);
// - „A franchise-od további címei”: a gyűjteményekben nem szereplő saját címek (sorozatok,
//   gyűjtemény nélküli filmek);
// - „+ TMDB-gyűjtemény hozzáadása”: keresés a TMDB gyűjteményei között (pl. Star Wars).
// A sáv akkor is megjelenik, ha nincs TMDB-gyűjtemény (a saját címekkel).
export default function FranchiseCollection({ franchise, franchiseNames, titles, orders, onAdded, onUpdated, onOrderChanged, onFranchiseUpdated, onRename, onDelete, readOnly }) {
  const params = collectionParams(franchise, titles);
  const { movies, extra } = params;
  const needsFetch = Boolean(movies || extra);
  const [collections, setCollections] = useState(needsFetch ? null : []); // null: betöltés alatt
  const [open, setOpen] = useState(false);
  // a franchise színe (terv-3 52.2, „B”; a korai visszatérés előtt – hook): ugyanaz, mint a Franchise-ok csempéjén és a gyűjtemény-ablakban
  const { style: ambientStyle, ...ambientData } = ambientProps(usePosterColor(franchisePosterPath(franchise.id, titles)));

  useEffect(() => {
    if (!movies && !extra) {
      setCollections([]);
      return;
    }
    const controller = new AbortController();
    fetchCollections({ movies, extra }, controller.signal)
      .then(setCollections)
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.warn('Gyűjtemény:', err.message);
        setCollections([]);
      });
    return () => controller.abort();
  }, [movies, extra]);

  if (collections === null) return null;

  const { sections, extras, manual, counts } = summarizeCollection(franchise, titles, collections);
  const { watched, onList } = counts;
  const backdrop = franchiseBackdrop(franchise, titles, sections);

  return (
    <>
      <div
        className="collection-banner"
        data-backdrop={backdrop ? '' : undefined}
        style={{ ...ambientStyle, ...(backdrop && { '--banner-img': `url(${IMG}w1280${backdrop})` }) }}
        {...ambientData}
      >
        {franchise.logo_path ? (
          // a w185-ös képeket a hangulatszín és a logó-világosság vászonra rajzolja: csak CORS-szal
          // (különben a gyorsítótárból engedély nélküli választ kapnának – CLAUDE.md, posterColor)
          <img className="collection-logo" src={`${IMG}w185${franchise.logo_path}`} alt={franchise.name} crossOrigin="anonymous" />
        ) : (
          <b>{franchise.name}</b>
        )}
        <CollectionMeter {...counts} />
        {/* a szám a mérővel egyezik: a listán lévők közül a megnézettek (Norbi kérése, 2026-10-06) */}
        <span className="collection-count">
          <b>
            {watched}/{onList}
          </b>{' '}
          megnézve
          {countsNote(counts)}
          {sections.length === 0 && ' · nincs hozzá TMDB-gyűjtemény'}
        </span>
        <button type="button" className="ghost" onClick={() => setOpen(true)}>
          Gyűjtemény
        </button>
      </div>
      {open && (
        <CollectionDialog
          franchise={franchise}
          franchiseNames={franchiseNames}
          sections={sections}
          extras={extras}
          counts={counts}
          manual={manual}
          titles={titles}
          orders={orders}
          onAdded={onAdded}
          onUpdated={onUpdated}
          onOrderChanged={onOrderChanged}
          onFranchiseUpdated={onFranchiseUpdated}
          onClose={() => setOpen(false)}
          onRename={onRename}
          onDelete={onDelete}
          readOnly={readOnly}
        />
      )}
    </>
  );
}

// A franchise képe (a sáv háttere és a gyűjtemény-ablak fejléce – terv-3 45, 2026-10-06): a
// franchise legjobb IMDb-értékelésű, háttérképes címének jelenetképe (mint a logónál), ha nincs, a
// TMDB-gyűjteményé.
function franchiseBackdrop(franchise, titles, sections) {
  const best = titles
    .filter((t) => t.franchise_id === franchise.id && t.backdrop_path)
    .sort((a, b) => (b.imdb_rating ?? -1) - (a.imdb_rating ?? -1) || (b.imdb_votes ?? 0) - (a.imdb_votes ?? 0))[0];
  return best?.backdrop_path ?? sections.find((s) => s.backdrop_path)?.backdrop_path ?? null;
}

// a listán lévő (felvett) címekből mennyi a megnézett: zöld, a többi a sáv szürkéje – a sávon, a
// gyűjtemény-ablakban és a Franchise-ok csempéin. A hiányzó TMDB-részek nem számítanak, türkiz
// nincs (Norbi döntése, 2026-10-06)
export function CollectionMeter({ watched, onList }) {
  return (
    <span className="collection-meter" aria-hidden="true">
      <i style={{ width: `${onList ? (watched / onList) * 100 : 0}%` }} />
    </span>
  );
}

function Poster({ path }) {
  return path ? (
    <img src={`${IMG}w185${path}`} alt="" loading="lazy" crossOrigin="anonymous" />
  ) : (
    <span className="poster-fallback" />
  );
}

// Két fül (Norbi döntése, terv-3 28): „Gyűjtemény” (a TMDB-gyűjtemények és a további címek) és
// „Nézési sorrend” (WatchOrder). A panelek rejtve megmaradnak (a sorrend vázlata nem vész el).
const TABS = [
  { id: 'collection', label: 'Gyűjtemény' },
  { id: 'order', label: 'Nézési sorrend' },
];

export function CollectionDialog({
  franchise,
  // id → név: a másik franchise-ban lévő rész mellé
  franchiseNames,
  sections,
  extras,
  counts,
  manual,
  titles,
  orders,
  onAdded,
  onUpdated,
  onOrderChanged,
  onFranchiseUpdated,
  onClose,
  onOutsideClose,
  // a fejléc műveletei (terv-3 57, mint a Franchise-ok csempéje alatt): onShow – „Szűrés erre” (a
  // lista fölötti sávból nyitva nincs, ott már erre szűr), onRename(id, név), onDelete(id)
  onShow,
  onRename,
  onDelete,
  // net nélkül (terv-3 44): csak nézni lehet – felvétel, gyűjtemény hozzárendelése / eltávolítása,
  // átnevezés, törlés nincs, a nézési sorrend csak olvasható (kódaudit #8)
  readOnly,
}) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const [state, setState] = useState({}); // tmdb_id → { busy } | { error }
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false); // a „+ TMDB-gyűjtemény” kereső nyitva
  const [tab, setTab] = useState('collection');
  const [ordering, setOrdering] = useState(false); // a nézési sorrend szerkesztése folyik
  const [sharing, setSharing] = useState(false); // a megosztás visszavonásának megerősítése / kérése
  const [edit, setEdit] = useState(null); // { mode: 'rename' | 'delete', name, error, busy } – terv-3 57
  const tabRefs = useRef({});
  const uniqueParts = (keep) => [
    ...new Map(sections.flatMap((s) => s.parts.filter(keep)).map((p) => [p.tmdb_id, p])).values(),
  ];
  const missing = uniqueParts((p) => !p.own && !p.listed);
  // a listán lévő, franchise nélküli részek (a másik franchise-ban lévőket csak egyenként, kérésre helyezi át)
  const unassigned = uniqueParts((p) => p.listed && !p.listed.franchise_id);
  const backdrop = franchiseBackdrop(franchise, titles, sections);
  // az ablak a franchise színében dereng (terv-3 51.10) – ugyanaz a szín, mint a Franchise-ok csempéjén
  const ambient = usePosterColor(franchisePosterPath(franchise.id, titles));
  const today = todayDate();

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
  }, []);

  async function add(p) {
    setState((s) => ({ ...s, [p.tmdb_id]: { busy: true } }));
    try {
      const row = await addTitle(p);
      onAdded(await updateTitle(row.id, { franchise_id: franchise.id }));
      setState((s) => ({ ...s, [p.tmdb_id]: {} }));
    } catch (err) {
      setState((s) => ({ ...s, [p.tmdb_id]: { error: err.message } }));
    }
  }

  // a listán lévő rész hozzárendelése ehhez a franchise-hoz (másik franchise-ból: áthelyezés)
  async function assign(p) {
    setState((s) => ({ ...s, [p.tmdb_id]: { busy: true } }));
    try {
      onUpdated(await updateTitle(p.listed.id, { franchise_id: franchise.id }));
      setState((s) => ({ ...s, [p.tmdb_id]: {} }));
    } catch (err) {
      setState((s) => ({ ...s, [p.tmdb_id]: { error: err.message } }));
    }
  }

  // a hiányzók kettesével (mint a tömeges import); a hozzárendelés ugyanígy
  async function inPairs(list, run) {
    for (let i = 0; i < list.length; i += 2) {
      await Promise.all(list.slice(i, i + 2).map(run));
    }
  }

  async function changeManual(ids) {
    setError('');
    try {
      onFranchiseUpdated(await setFranchiseCollections(franchise.id, ids));
    } catch (err) {
      setError(err.message);
    }
  }

  const busyAny = Object.values(state).some((s) => s.busy);
  // asztalon kikattintásra bezárul – felvétel közben, a nézési sorrend szerkesztése közben és a
  // megosztás visszavonásának megerősítésekor nem.
  // A nyitott TMDB-gyűjtemény-kereső nem tartja nyitva (Norbi kérése, 2026-10-07: a beírt keresés
  // elvesztése nem baj). onOutsideClose: a Franchise-ok ablakból nyitva az is bezárul
  const outsideClose = useBackdropClose(dialogRef, {
    onClose: () => {
      dialogRef.current.close();
      onOutsideClose?.();
    },
    canClose: () => !busyAny && !ordering && !sharing && !edit,
  });

  async function saveRename(event) {
    event.preventDefault();
    const name = edit.name.trim();
    if (!name) return;
    setEdit((e) => ({ ...e, busy: true, error: '' }));
    try {
      await onRename(franchise.id, name);
      setEdit(null);
    } catch (err) {
      setEdit((e) => ({ ...e, busy: false, error: err.message }));
    }
  }

  // törlés után a franchise eltűnik: az ablak a szülővel együtt bezárul
  async function confirmDelete() {
    setEdit((e) => ({ ...e, busy: true, error: '' }));
    try {
      await onDelete(franchise.id);
    } catch (err) {
      setEdit((e) => ({ ...e, busy: false, error: err.message }));
    }
  }

  // a fülek között nyilakkal is (Home / End: az első / az utolsó)
  function tabKey(e) {
    const i = TABS.findIndex((t) => t.id === tab);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = TABS[(to + TABS.length) % TABS.length].id;
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <dialog
      ref={dialogRef}
      className="editor collection-dialog"
      aria-labelledby="collection-title"
      {...ambientProps(ambient)}
      onClose={onClose}
      // sorrend-szerkesztés közben az Esc csak a szerkesztést zárja (a vázlat elvész)
      onCancel={(e) => {
        if (e.target === e.currentTarget && ordering) {
          e.preventDefault();
          setOrdering(false);
        }
      }}
      // az átnevezés mezőjében / a törlés megerősítésénél az Esc csak azt zárja
      onKeyDown={(e) => {
        if (e.key === 'Escape' && edit) {
          e.preventDefault();
          setEdit(null);
        }
      }}
      {...outsideClose}
    >
      <div
        className="collection-head"
        style={backdrop ? { backgroundImage: `url(${IMG}w1280${backdrop})` } : undefined}
      >
        <h2 id="collection-title" ref={headingRef} tabIndex={-1}>
          {franchise.name}
        </h2>
        <p className="collection-sub">
          {sections.length
            ? `${sections.length} TMDB-gyűjtemény, a részek megjelenési sorrendben`
            : readOnly
              ? 'Nincs hozzá TMDB-gyűjtemény'
              : 'Nincs hozzá TMDB-gyűjtemény – lent kézzel hozzárendelhetsz egyet'}
          {' · '}
          {counts.total} cím
        </p>
        <p className="collection-prog">
          <CollectionMeter {...counts} />
          <span>
            <b>
              {counts.watched}/{counts.onList}
            </b>{' '}
            megnézve
            {countsNote(counts)}
          </span>
        </p>
        {edit?.mode === 'rename' ? (
          <form className="fr-edit collection-actions" onSubmit={saveRename}>
            <input
              autoFocus
              aria-label={`„${franchise.name}” új neve`}
              value={edit.name}
              onChange={(e) => setEdit((x) => ({ ...x, name: e.target.value }))}
            />
            <button type="submit" className="primary mini" disabled={edit.busy}>
              Mentés
            </button>
            <button type="button" className="ghost mini" onClick={() => setEdit(null)}>
              Mégse
            </button>
          </form>
        ) : edit?.mode === 'delete' ? (
          <div className="fr-edit fr-confirm collection-actions">
            <span className="confirm-text">Törlöd a franchise-t? A címekről lekerül, a címek maradnak.</span>
            <button type="button" className="ghost mini" autoFocus onClick={() => setEdit(null)}>
              Mégse
            </button>
            <button type="button" className="danger mini" disabled={edit.busy} onClick={confirmDelete}>
              Törlés
            </button>
          </div>
        ) : (
          (onShow || (!readOnly && (onRename || onDelete))) && (
            <div className="fr-actions collection-actions">
              {onShow && (
                <button type="button" className="link small" disabled={counts.onList === 0} onClick={() => onShow(franchise.id)}>
                  Szűrés erre
                </button>
              )}
              {!readOnly && onRename && (
                <button type="button" className="link small" onClick={() => setEdit({ mode: 'rename', name: franchise.name, error: '' })}>
                  Átnevezés
                </button>
              )}
              {!readOnly && onDelete && (
                <button type="button" className="danger-link small" onClick={() => setEdit({ mode: 'delete', error: '' })}>
                  Törlés
                </button>
              )}
            </div>
          )
        )}
        {edit?.error && (
          <p className="error small" role="alert">
            {edit.error}
          </p>
        )}
      </div>

      <div className="dialog-tabs" role="tablist" aria-label="Nézet">
        {TABS.map((t) => (
          <button
            key={t.id}
            ref={(el) => (tabRefs.current[t.id] = el)}
            type="button"
            role="tab"
            id={`collection-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`collection-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={tabKey}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="collection-panel-order"
        aria-labelledby="collection-tab-order"
        className="collection-section"
        hidden={tab !== 'order'}
      >
        <WatchOrder
          franchise={franchise}
          titles={titles}
          orders={orders}
          editing={ordering}
          onEditingChange={setOrdering}
          onOrderChanged={onOrderChanged}
          onUpdated={onUpdated}
          onShareBusyChange={setSharing}
          readOnly={readOnly}
        />
      </div>

      <div role="tabpanel" id="collection-panel-collection" aria-labelledby="collection-tab-collection" hidden={tab !== 'collection'}>
      {sections.map((s) => (
        <section key={s.id} className="collection-section" aria-labelledby={`collection-${s.id}`}>
          <div className="collection-section-head">
            <h3 id={`collection-${s.id}`}>{s.name}</h3>
            {s.manual && (
              <>
                <span className="muted small">kézzel hozzárendelve</span>
                {!readOnly && (
                  <button
                    type="button"
                    className="link small"
                    onClick={() => changeManual(manual.filter((id) => id !== s.id))}
                  >
                    Eltávolítás
                  </button>
                )}
              </>
            )}
          </div>
          <ol className="collection-parts">
            {s.parts.map((p) => {
              const st = state[p.tmdb_id] ?? {};
              const status = p.own ? p.own.status : p.listed ? 'listed' : 'missing';
              // még meg nem jelent rész (dátum nélkül vagy jövőbeli): indigó jelölés (terv-3 52.1)
              const upcoming = !p.release_date || p.release_date > today;
              const other = p.listed?.franchise_id ? franchiseNames?.get(p.listed.franchise_id) : null;
              return (
                <li key={p.tmdb_id} data-state={status} data-upcoming={upcoming || undefined}>
                  <div className="collection-poster">
                    <Poster path={p.poster_path} />
                    {p.own?.is_downloaded && <span className="badge">Letöltve</span>}
                  </div>
                  <b>{p.title}</b>
                  <span className="muted small part-year">{p.release_year ?? 'Bejelentve'}</span>
                  {p.own ? (
                    <OwnState t={p.own} />
                  ) : p.listed ? (
                    <>
                      <span className="collection-state listed">
                        {p.listed.franchise_id ? `A listádon – ${other ? `„${other}”` : 'másik franchise'}` : 'A listádon, franchise nélkül'}
                      </span>
                      {!readOnly && (
                        <button type="button" className="ghost" disabled={st.busy} onClick={() => assign(p)}>
                          {st.busy ? 'Hozzárendelés…' : p.listed.franchise_id ? 'Áthelyezés ide' : '+ Hozzárendelés'}
                        </button>
                      )}
                    </>
                  ) : (
                    !readOnly && (
                      <button type="button" className="ghost" disabled={st.busy} onClick={() => add(p)}>
                        {st.busy ? 'Hozzáadás…' : '+ Hozzáadás'}
                      </button>
                    )
                  )}
                  {st.error && (
                    <p className="error small" role="alert">
                      {st.error}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {extras.length > 0 && (
        <section className="collection-section" aria-labelledby="collection-extras">
          <div className="collection-section-head">
            <h3 id="collection-extras">
              {sections.length ? 'A franchise-od további címei' : 'A franchise-od címei'}
            </h3>
            <span className="muted small">
              {sections.length ? 'a listádon, de egyik fenti gyűjteménynek sem része' : 'a listádon, megjelenés szerint'}
            </span>
          </div>
          <ol className="collection-parts extras">
            {extras.map((t) => (
              <li key={t.id} data-state={t.status}>
                <div className="collection-poster">
                  <Poster path={t.poster_path} />
                  {t.is_downloaded && <span className="badge">Letöltve</span>}
                </div>
                <b>{t.title}</b>
                <span className="muted small">
                  {t.release_year ?? '–'} · {t.media_type === 'tv' ? 'Sorozat' : 'Film'}
                </span>
                <OwnState t={t} />
              </li>
            ))}
          </ol>
        </section>
      )}

      {!readOnly && (
      <section className="collection-section collection-manual">
        {searching ? (
          <CollectionSearch
            franchise={franchise}
            titles={titles}
            assigned={new Set([...manual, ...sections.map((s) => s.id)])}
            onPick={(c) => changeManual([...manual, c.id])}
            onClose={() => setSearching(false)}
          />
        ) : (
          <button type="button" className="ghost" onClick={() => setSearching(true)}>
            + TMDB-gyűjtemény hozzáadása
          </button>
        )}
        {error && (
          <p className="error small" role="alert">
            {error}
          </p>
        )}
      </section>
      )}
      </div>

      <div className="editor-actions">
        {tab === 'collection' && unassigned.length > 1 && !readOnly && (
          <button type="button" className="ghost" disabled={busyAny} onClick={() => inPairs(unassigned, assign)}>
            A listádon lévő {unassigned.length} hozzárendelése
          </button>
        )}
        {tab === 'collection' && missing.length > 1 && !readOnly && (
          <button type="button" className="ghost" disabled={busyAny} onClick={() => inPairs(missing, add)}>
            A hiányzó {missing.length} felvétele
          </button>
        )}
        <span className="spacer" />
        <button type="button" className="primary" onClick={() => dialogRef.current.close()}>
          Bezárás
        </button>
      </div>
    </dialog>
  );
}

// a listán lévő cím állapota: megnézve (saját értékelés borostyánnal) vagy „A listán”
function OwnState({ t }) {
  return t.status === 'watched' ? (
    <span className="collection-state watched">
      ✓ Megnézve{t.my_rating && <span className="mine"> · {t.my_rating}/10</span>}
    </span>
  ) : (
    <span className={t.status === 'dropped' ? 'collection-state dropped' : 'collection-state'}>
      {t.status === 'dropped' ? 'Abbahagyva' : 'A listán'}
    </span>
  );
}

// a javaslatok keresőszavai (terv-3 53): a franchise neve és a filmjei eredeti címének eleje (a
// kettőspont / gondolatjel előtti rész, a sorszám nélkül – „Dune: Part Two” → „Dune”)
function suggestQueries(franchise, titles) {
  const base = (s) =>
    (s ?? '')
      .split(/\s*:\s*|\s+[–-]\s+/)[0]
      .replace(/\s+(\d+|[IVX]+)$/, '')
      .trim();
  const own = titles.filter((t) => t.franchise_id === franchise.id).map((t) => base(t.original_title || t.title));
  const seen = new Set();
  return [franchise.name, ...own].filter((q) => q.length >= 2 && !seen.has(q.toLowerCase()) && seen.add(q.toLowerCase())).slice(0, 6);
}

// TMDB-gyűjtemény keresése és hozzárendelése (késleltetett keresés, mint a Cím hozzáadása); üres
// keresőnél javaslatok (terv-3 53, a franchise nevéből és a filmjei eredeti címéből – a már
// hozzárendeltek nélkül). A név és a borító új lapon a gyűjtemény TMDB-oldalára visz.
function CollectionSearch({ franchise, titles, assigned, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState({ q: '', results: [], error: '' });
  const [suggested, setSuggested] = useState(null); // null: betöltés alatt
  const q = query.trim();
  const queries = suggestQueries(franchise, titles).join('|');

  useEffect(() => {
    const controller = new AbortController();
    apiGet('/api/tmdb/collection-search', { suggest: queries }, { signal: controller.signal })
      .then((data) => setSuggested(data.results))
      .catch((err) => err.name !== 'AbortError' && setSuggested([]));
    return () => controller.abort();
  }, [queries]);

  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiGet('/api/tmdb/collection-search', { q }, { signal: controller.signal })
        .then((data) => setFound({ q, results: data.results, error: '' }))
        .catch((err) => err.name !== 'AbortError' && setFound({ q, results: [], error: err.message }));
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);

  const done = q.length >= 2 && found.q === q;
  const suggestions = (suggested ?? []).filter((c) => !assigned.has(c.id));
  return (
    <div className="collection-search">
      <div className="collection-search-row">
        <label className="search-field">
          TMDB-gyűjtemény keresése (angol címmel is, pl. „Star Wars”)
          <input type="search" autoFocus autoComplete="off" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button type="button" className="ghost" onClick={onClose}>
          Mégse
        </button>
      </div>
      <p className="search-status" aria-live="polite">
        {q.length >= 2
          ? !done
            ? 'Keresés…'
            : !found.error
              ? found.results.length
                ? `${found.results.length} gyűjtemény`
                : `Nincs ilyen gyűjtemény: „${q}”. Próbáld angolul.`
              : ''
          : suggested === null
            ? 'Javaslatok betöltése…'
            : suggestions.length
              ? 'Javasolt gyűjtemények'
              : 'Nincs több javaslat – keress rá a gyűjtemény nevére.'}
      </p>
      {done && found.error && (
        <p className="error small" role="alert">
          {found.error}
        </p>
      )}
      {q.length >= 2 ? (
        done && <CollectionResults results={found.results} assigned={assigned} onPick={onPick} />
      ) : (
        <CollectionResults results={suggestions} assigned={assigned} onPick={onPick} suggested />
      )}
    </div>
  );
}

// a talált / javasolt gyűjtemények: borító és név – új lapon a TMDB-oldalra (terv-3 53) –, „Hozzárendelés”
function CollectionResults({ results, assigned, onPick, suggested }) {
  if (results.length === 0) return null;
  return (
    <ul className="collection-results" data-suggested={suggested || undefined}>
      {results.map((c) => {
        const url = `https://www.themoviedb.org/collection/${c.id}`;
        return (
          <li key={c.id}>
            <a className="thumb" href={url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
              {c.poster_path && <img src={`${IMG}w92${c.poster_path}`} alt="" loading="lazy" />}
            </a>
            <a className="collection-result-name" href={url} target="_blank" rel="noopener noreferrer">
              {c.name}
              <span className="sr-only"> (TMDB-oldal, új lapon)</span>
            </a>
            {assigned.has(c.id) ? (
              <span className="on-list">✓ Hozzárendelve</span>
            ) : (
              <button type="button" className="ghost" onClick={() => onPick(c)}>
                Hozzárendelés
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
