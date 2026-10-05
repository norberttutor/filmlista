'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FranchiseLogo } from '@/components/FranchiseFilter';
import {
  CollectionDialog,
  CollectionMeter,
  collectionParams,
  fetchCollections,
  paramsKey,
  summarizeCollection,
} from '@/components/FranchiseCollection';
import { mapLimit } from '@/lib/bulkImport';
import { useBackdropClose } from '@/lib/useBackdropClose';

// kis- és nagybetű, ékezet nélkül (a kereséshez)
const fold = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
// ábécérend névelő nélkül (Norbi döntése): „A majmok bolygója” az M-nél, „The Purge” a P-nél
const sortKey = (name) => name.replace(/^(a|az|the)\s+/i, '');
const byNameNoArticle = (a, b) => sortKey(a.name).localeCompare(sortKey(b.name), 'hu', { sensitivity: 'base' });

// „Franchise-ok” (a ⋮ menüből): az összes franchise ábécérendben, csempénként logóval, számokkal
// (megnézve / a listán / hiányzik – a TMDB-gyűjteményekből, 3-asával betöltve). A csempe a
// gyűjtemény-ablakot nyitja; „Szűrés erre”, „Átnevezés”, „Törlés”; alul „+ Új franchise”.
export default function FranchisesDialog({
  franchises,
  titles,
  onCreate,
  onRename,
  onDelete,
  onShow,
  onAdded,
  onFranchiseUpdated,
  onClose,
}) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const [query, setQuery] = useState('');
  // franchise id → { key, collections } (a legutóbb betöltött; a kulcs a lekérés paraméterei)
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
    return () => controllerRef.current?.abort();
  }, []);

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
    mapLimit(
      todo,
      3,
      async ({ id, key, params, token }) => {
        let collections = [];
        try {
          collections = await fetchCollections(params, signal);
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn('Gyűjtemény:', err.message); // a számok a saját címekből
        }
        pending.current.delete(token);
        setLoaded((m) => new Map(m).set(id, { key, collections }));
      },
      () => {}
    );
  }, [franchises, titles, loaded]);

  const rows = [...franchises].sort(byNameNoArticle).map((f) => {
    const key = paramsKey(collectionParams(f, titles));
    const entry = loaded.get(f.id);
    return {
      f,
      ready: entry?.key === key,
      ownCount: titles.filter((t) => t.franchise_id === f.id).length,
      summary: summarizeCollection(f, titles, entry?.collections ?? []),
    };
  });
  const q = fold(query.trim());
  const shown = q ? rows.filter((r) => fold(r.f.name).includes(q)) : rows;
  const open = rows.find((r) => r.f.id === openId);

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

        {shown.length === 0 && (
          <p className="muted">{q ? `Nincs ilyen franchise: „${query.trim()}”.` : 'Még nincs franchise-od.'}</p>
        )}

        <ul className="fr-grid" aria-label="Franchise-ok">
          {shown.map(({ f, ready, ownCount, summary }) => {
            const { counts, sections } = summary;
            const editing = edit?.id === f.id ? edit : null;
            return (
              <li key={f.id} className="fr-tile" data-editing={editing ? editing.mode : undefined}>
                <button type="button" className="fr-main" aria-busy={!ready || undefined} onClick={() => setOpenId(f.id)}>
                  <span className="fr-logo">{f.logo_path ? <FranchiseLogo path={f.logo_path} /> : <b>{f.name}</b>}</span>
                  <span className="fr-name">{f.name}</span>
                  <CollectionMeter {...counts} />
                  <span className="fr-count">
                    {counts.total === 0 && ready ? (
                      'Még nincs címe'
                    ) : (
                      <>
                        <b>
                          {counts.watched}/{counts.total}
                        </b>{' '}
                        megnézve · {counts.onList} a listán
                        {ready ? counts.missing > 0 && ` · ${counts.missing} hiányzik` : ' · …'}
                        {ready && sections.length === 0 && counts.total > 0 && ' · nincs TMDB-gyűjtemény'}
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
                    <span className="confirm-text">Törlöd? A címekről lekerül, a címek maradnak.</span>
                    <button type="button" className="ghost mini" autoFocus onClick={() => setEdit(null)}>
                      Mégse
                    </button>
                    <button type="button" className="danger mini" disabled={editing.busy} onClick={confirmDelete}>
                      Törlés
                    </button>
                  </div>
                ) : (
                  <div className="fr-actions">
                    <button type="button" className="link small" disabled={ownCount === 0} onClick={() => onShow(f.id)}>
                      Szűrés erre
                    </button>
                    <button type="button" className="link small" onClick={() => setEdit({ id: f.id, mode: 'rename', name: f.name, error: '' })}>
                      Átnevezés
                    </button>
                    <button type="button" className="danger-link small" onClick={() => setEdit({ id: f.id, mode: 'delete', error: '' })}>
                      Törlés
                    </button>
                  </div>
                )}
                {editing?.error && (
                  <p className="error small" role="alert">
                    {editing.error}
                  </p>
                )}
              </li>
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
            <button type="button" className="ghost" onClick={() => setCreating({ name: '', error: '' })}>
              + Új franchise
            </button>
          )}
        </div>
      </div>

      {open?.ready && (
        <CollectionDialog
          franchise={open.f}
          sections={open.summary.sections}
          extras={open.summary.extras}
          counts={open.summary.counts}
          manual={open.summary.manual}
          onAdded={onAdded}
          onFranchiseUpdated={onFranchiseUpdated}
          onClose={() => setOpenId(null)}
        />
      )}
    </dialog>
  );
}
