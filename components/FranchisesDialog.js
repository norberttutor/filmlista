'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FranchiseLogo } from '@/components/FranchiseFilter';
import {
  CollectionDialog,
  CollectionMeter,
  collectionParams,
  countsNote,
  fetchCollections,
  paramsKey,
  summarizeCollection,
} from '@/components/FranchiseCollection';
import { mapLimit } from '@/lib/bulkImport';
import { fold } from '@/lib/listSearch'; // kis- és nagybetű, ékezet nélkül (a kereséshez)
import { useBackdropClose } from '@/lib/useBackdropClose';
import { usePosterColor, ambientProps, franchisePosterPath } from '@/lib/posterColor';
import { article, franchiseSuggestions } from '@/lib/franchiseSuggest';
import FranchiseSuggestions from '@/components/FranchiseSuggestions';
import { FranchiseActions } from '@/components/FranchiseActions';

// ábécérend névelő nélkül (Norbi döntése): „A majmok bolygója” az M-nél, „The Purge” a P-nél
const sortKey = (name) => name.replace(/^(a|az|the)\s+/i, '');
const byNameNoArticle = (a, b) => sortKey(a.name).localeCompare(sortKey(b.name), 'hu', { sensitivity: 'base' });

// „Franchise-ok” (a ⋮ menüből): az összes franchise ábécérendben, csempénként logóval, számokkal
// (megnézve a listán lévőkből / hiányzik – a TMDB-gyűjteményekből, 3-asával betöltve). A csempe a
// gyűjtemény-ablakot nyitja; „Szűrés erre”, „Átnevezés”, „Törlés”; alul „+ Új franchise”.
export default function FranchisesDialog({
  franchises,
  titles,
  orders,
  onCreate,
  onRename,
  onDelete,
  onShow,
  onAdded,
  onUpdated,
  onOrderChanged,
  onFranchiseUpdated,
  onClose,
  // net nélkül (terv-3 44): csak nézni lehet – nincs új franchise, átnevezés, törlés, javaslat; a
  // csempe a gyűjtemény-ablakot csak olvashatóan nyitja, a „Szűrés erre” marad (kódaudit #8)
  readOnly,
}) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const [query, setQuery] = useState('');
  // franchise id → { key, collections, failed } (a legutóbb betöltött; a kulcs a lekérés paraméterei;
  // failed: a TMDB nem válaszolt – átnézés H2)
  const [loaded, setLoaded] = useState(() => new Map());
  const pending = useRef(new Set());
  const controllerRef = useRef(null);
  const [openId, setOpenId] = useState(null); // a gyűjtemény-ablak ehhez a franchise-hoz
  const [edit, setEdit] = useState(null); // { id, mode: 'rename' | 'delete', name, error, busy }
  const [creating, setCreating] = useState(null); // { name, error, busy }
  // asztalon kikattintásra bezárul – szerkesztés közben (átnevezés, törlés megerősítése, új név) nem,
  // hogy a beírt szöveg ne vesszen el; a nyitott gyűjtemény-ablakot a saját kikattintása zárja
  const backdrop = useBackdropClose(dialogRef, {
    onClose: () => dialogRef.current.close(),
    canClose: () => !edit && !creating && openId == null,
  });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
    controllerRef.current = new AbortController();
    return () => {
      controllerRef.current?.abort();
      // a megszakított betöltések nem függők: fejlesztői módban (StrictMode) a React lebontja és újra
      // felcsatolja az ablakot – különben az újracsatolt betöltés mindet függőnek látná, és semmi nem
      // töltődne be (kódaudit #39). Élesben ez csak a bezáráskor fut.
      pending.current.clear();
    };
  }, []);

  // egy franchise gyűjteményeinek betöltése (hibánál üresen – a számok a saját címekből –, megjelölve,
  // hogy ne „nincs TMDB-gyűjtemény” látsszon; újrapróbálás: retryOne)
  async function loadOne({ id, key, params, token }, signal) {
    let collections = [];
    let failed = false;
    try {
      collections = await fetchCollections(params, signal);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('Gyűjtemény:', err.message);
      failed = true;
    }
    pending.current.delete(token);
    setLoaded((m) => {
      // újrapróbáláskor a korábbi (sikeres) gyűjtemények maradnak
      const before = m.get(id);
      if (failed && before?.key === key && before.collections.length) collections = before.collections;
      return new Map(m).set(id, { key, collections, failed });
    });
  }

  // sikertelen betöltés újra (a csempére kattintva / a gyűjtemény-ablak „Újrapróbálás”-ára)
  function retryOne(f) {
    const params = collectionParams(f, titles);
    const key = paramsKey(params);
    const token = `${f.id}:${key}`;
    if (pending.current.has(token)) return;
    rushed.current.add(token);
    pending.current.add(token);
    loadOne({ id: f.id, key, params, token }, controllerRef.current.signal);
  }

  // a még be nem töltött csempére kattintva (átnézés H9, 2026-10-16): a franchise soron kívül, azonnal töltődik – a
  // gyűjtemény-ablak a betöltés után nyílik (addig a csempén „megnyitás…”); korábban a 3-asával haladó sorra várt,
  // a lista végén akár fél percig, és a kattintás látszólag semmit nem csinált
  const rushed = useRef(new Set());
  function openFranchise(f) {
    setOpenId(f.id);
    if (loaded.has(f.id)) {
      // a korábbi gyűjteményekkel nyílik, az újratöltés közben is (kódaudit #6)
      if (loaded.get(f.id).failed) retryOne(f);
      return;
    }
    const params = collectionParams(f, titles);
    const key = paramsKey(params);
    const token = `${f.id}:${key}`;
    if (rushed.current.has(token)) return;
    rushed.current.add(token);
    pending.current.add(token);
    loadOne({ id: f.id, key, params, token }, controllerRef.current.signal);
  }

  // a gyűjtemények betöltése 3-asával; ha egy franchise címei / kézi gyűjteményei változnak
  // (pl. hiányzó rész felvétele után), azt újra
  useEffect(() => {
    const todo = [];
    for (const f of franchises) {
      const params = collectionParams(f, titles);
      const key = paramsKey(params);
      const token = `${f.id}:${key}`;
      if (loaded.get(f.id)?.key === key || pending.current.has(token)) continue;
      pending.current.add(token);
      todo.push({ id: f.id, key, params, token });
    }
    if (todo.length === 0) return;
    const signal = controllerRef.current.signal;
    // a soron kívül (kattintásra) betöltötteket kihagyja
    mapLimit(todo, 3, (item) => (rushed.current.has(item.token) ? null : loadOne(item, signal)), () => {});
  }, [franchises, titles, loaded]);

  const rows = [...franchises].sort(byNameNoArticle).map((f) => {
    const key = paramsKey(collectionParams(f, titles));
    const entry = loaded.get(f.id);
    return {
      f,
      ready: entry?.key === key,
      failed: Boolean(entry?.failed),
      ownCount: titles.filter((t) => t.franchise_id === f.id).length,
      summary: summarizeCollection(f, titles, entry?.collections ?? []),
    };
  });
  const q = fold(query.trim());
  const shown = q ? rows.filter((r) => fold(r.f.name).includes(q)) : rows;
  const open = rows.find((r) => r.f.id === openId);

  // a nyitott gyűjtemény-ablak franchise-a törlődött (a fejléc „Törlés”-ével vagy máshol – átnézés
  // H7): az ablak eltűnik, az openId is nullázódik (különben a Franchise-ok ablak nem zárna
  // kikattintásra); az épp létrehozott, még nem látott franchise-t nem bántja
  const knownIds = useRef(new Set());
  useEffect(() => {
    const ids = new Set(franchises.map((f) => f.id));
    if (openId != null && knownIds.current.has(openId) && !ids.has(openId)) {
      setOpenId(null);
      headingRef.current?.focus();
    }
    knownIds.current = ids;
  }, [franchises, openId]);

  async function saveRename(event) {
    event.preventDefault();
    const name = edit.name.trim();
    if (!name) return;
    setEdit((e) => ({ ...e, busy: true, error: '' }));
    try {
      await onRename(edit.id, name);
      setEdit(null);
    } catch (err) {
      setEdit((e) => ({ ...e, busy: false, error: err.message }));
    }
  }

  async function confirmDelete() {
    setEdit((e) => ({ ...e, busy: true, error: '' }));
    try {
      await onDelete(edit.id);
      setEdit(null);
    } catch (err) {
      setEdit((e) => ({ ...e, busy: false, error: err.message }));
    }
  }

  async function create(event) {
    event.preventDefault();
    const name = creating.name.trim();
    if (!name) return;
    setCreating((c) => ({ ...c, busy: true, error: '' }));
    try {
      const created = await onCreate(name);
      setCreating(null);
      setOpenId(created.id); // a gyűjtemény-ablakban rögtön hozzárendelhető egy TMDB-gyűjtemény
    } catch (err) {
      setCreating((c) => ({ ...c, busy: false, error: err.message }));
    }
  }

  // a szerkesztőmezőben az Esc csak a szerkesztést zárja, az ablakot nem
  const escToCancel = (cancel) => (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="editor stats-dialog franchises-dialog"
      aria-labelledby="franchises-title"
      // a benne nyíló gyűjtemény-ablak „close” eseményét a React ide is továbbítja: csak a sajátjára zárunk
      onClose={(e) => e.target === e.currentTarget && onClose()}
      // szerkesztés / megerősítés közben az Esc és a Vissza gomb („cancel”) csak azt zárja, a beírt
      // név ne vesszen el (átnézés H8); a belső gyűjtemény-ablak eseménye is ideér – az nem számít
      onCancel={(e) => {
        if (e.target !== e.currentTarget || (!edit && !creating)) return;
        e.preventDefault();
        if (edit && !edit.busy) setEdit(null);
        if (creating && !creating.busy) setCreating(null);
      }}
      {...backdrop}
    >
      <div>
        <header className="stats-head">
          <h2 id="franchises-title" ref={headingRef} tabIndex={-1}>
            Franchise-ok
          </h2>
          <p>{franchises.length} franchise · ábécérendben</p>
          <button type="button" className="ghost" onClick={() => dialogRef.current.close()}>
            Bezárás
          </button>
        </header>

        <input
          type="search"
          className="franchises-search"
          aria-label="Keresés a franchise-ok között"
          placeholder="Keresés a franchise-ok között"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {/* javasolt hozzárendelések (terv-3 35) – keresés közben nem */}
        {!q && !readOnly && (
          <FranchiseSuggestions suggestions={franchiseSuggestions(titles, franchises)} onUpdated={onUpdated} />
        )}

        {shown.length === 0 && (
          <p className="muted">{q ? `Nincs ilyen franchise: „${query.trim()}”.` : 'Még nincs franchise-od.'}</p>
        )}

        <ul className="fr-grid" aria-label="Franchise-ok">
          {shown.map(({ f, ready, failed, ownCount, summary }) => {
            const { counts, sections } = summary;
            const editing = edit?.id === f.id ? edit : null;
            // rákattintott, de a gyűjteményei még töltődnek (átnézés H9): a betöltés után nyílik
            const opening = openId === f.id && !loaded.has(f.id);
            return (
              <FranchiseTile key={f.id} posterPath={tintPoster(f, titles)} data-editing={editing ? editing.mode : undefined}>
                <button
                  type="button"
                  className="fr-main"
                  aria-busy={!ready || undefined}
                  data-opening={opening ? '' : undefined}
                  onClick={() => openFranchise(f)}
                >
                  <span className="fr-logo">{f.logo_path ? <FranchiseLogo path={f.logo_path} /> : <b>{f.name}</b>}</span>
                  <span className="fr-name">{f.name}</span>
                  <CollectionMeter {...counts} />
                  <span className="fr-count">
                    {counts.total === 0 && ready ? (
                      'Még nincs címe'
                    ) : (
                      <>
                        <b>
                          {counts.watched}/{counts.onList}
                        </b>{' '}
                        megnézve
                        {ready ? countsNote(counts) : opening ? ' · megnyitás…' : ' · …'}
                        {ready && failed
                          ? ' · a TMDB nem válaszolt'
                          : ready && sections.length === 0 && counts.total > 0 && ' · nincs TMDB-gyűjtemény'}
                      </>
                    )}
                  </span>
                </button>

                {editing?.mode === 'rename' ? (
                  <form className="fr-edit" onSubmit={saveRename}>
                    <input
                      autoFocus
                      aria-label={`„${f.name}” új neve`}
                      value={editing.name}
                      onChange={(e) => setEdit((x) => ({ ...x, name: e.target.value }))}
                      onKeyDown={escToCancel(() => setEdit(null))}
                    />
                    <button type="submit" className="primary mini" disabled={editing.busy}>
                      Mentés
                    </button>
                    <button type="button" className="ghost mini" onClick={() => setEdit(null)}>
                      Mégse
                    </button>
                  </form>
                ) : editing?.mode === 'delete' ? (
                  <div className="fr-edit fr-confirm">
                    <span className="confirm-text">
                      Törlöd {article(f.name)} „{f.name}” franchise-t? A címekről lekerül, a címek maradnak.
                    </span>
                    <button type="button" className="ghost mini" autoFocus onClick={() => setEdit(null)}>
                      Mégse
                    </button>
                    <button type="button" className="danger mini" disabled={editing.busy} onClick={confirmDelete}>
                      Törlés
                    </button>
                  </div>
                ) : (
                  <FranchiseActions
                    compact
                    name={f.name}
                    onShow={() => onShow(f.id)}
                    showDisabled={ownCount === 0}
                    onRename={readOnly ? null : () => setEdit({ id: f.id, mode: 'rename', name: f.name, error: '' })}
                    onDelete={readOnly ? null : () => setEdit({ id: f.id, mode: 'delete', error: '' })}
                  />
                )}
                {editing?.error && (
                  <p className="error small" role="alert">
                    {editing.error}
                  </p>
                )}
              </FranchiseTile>
            );
          })}
        </ul>

        <div className="fr-create">
          {creating ? (
            <form className="fr-edit" onSubmit={create}>
              <input
                autoFocus
                aria-label="Az új franchise neve"
                placeholder="Az új franchise neve"
                value={creating.name}
                onChange={(e) => setCreating((c) => ({ ...c, name: e.target.value }))}
                onKeyDown={escToCancel(() => setCreating(null))}
              />
              <button type="submit" className="primary mini" disabled={creating.busy}>
                Létrehozás
              </button>
              <button type="button" className="ghost mini" onClick={() => setCreating(null)}>
                Mégse
              </button>
              {creating.error && (
                <p className="error small" role="alert">
                  {creating.error}
                </p>
              )}
            </form>
          ) : (
            !readOnly && (
              <button type="button" className="ghost" onClick={() => setCreating({ name: '', error: '' })}>
                + Új franchise
              </button>
            )
          )}
        </div>
      </div>

      {/* az első betöltés után nyitva marad: felvételkor / gyűjtemény hozzárendelésekor (a kulcs
          változik) az újratöltés alatt a korábbi gyűjteményekkel – mint a lista fölötti sáv –,
          így a fül, a görgetés, a kereső és a folyamatjelzés megmarad (kódaudit #6) */}
      {open && loaded.has(open.f.id) && (
        <CollectionDialog
          franchise={open.f}
          franchiseNames={new Map(franchises.map((f) => [f.id, f.name]))}
          sections={open.summary.sections}
          extras={open.summary.extras}
          counts={open.summary.counts}
          manual={open.summary.manual}
          titles={titles}
          orders={orders}
          onAdded={onAdded}
          onUpdated={onUpdated}
          onOrderChanged={onOrderChanged}
          onFranchiseUpdated={onFranchiseUpdated}
          onClose={() => setOpenId(null)}
          // a gyűjtemény-ablak mellé kattintva a Franchise-ok ablak is bezárul (Norbi kérése, 2026-10-07)
          onOutsideClose={() => dialogRef.current?.close()}
          // a csempe három művelete a gyűjtemény-ablak fejlécében is (terv-3 57)
          onShow={onShow}
          onRename={onRename}
          onDelete={onDelete}
          readOnly={readOnly}
          loadFailed={open.failed}
          onRetry={() => retryOne(open.f)}
        />
      )}
    </dialog>
  );
}

// A csempe hangulatszíne (terv-3 47, 2026-10-06, Norbi kérésére látványterv nélkül): a franchise
// legjobb IMDb-értékelésű, borítós címének borítójából (lib/posterColor.js, mint az adatlapé) – a
// keret, a logó háttere és a csempe teteje halványan ebben a színben (CSS: .fr-tile[data-ambient]).
// A választás közös (franchisePosterPath): a Statisztika és a gyűjtemény-ablak is ezt használja.
function tintPoster(franchise, titles) {
  return franchisePosterPath(franchise.id, titles);
}

function FranchiseTile({ posterPath, children, ...rest }) {
  const ambient = usePosterColor(posterPath);
  const { style, ...data } = ambientProps(ambient);
  return (
    <li className="fr-tile" style={style} {...data} {...rest}>
      {children}
    </li>
  );
}
