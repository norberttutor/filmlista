'use client';

// Tömeges szerkesztés (terv-3 145, Norbi döntése: „A”) – csak az asztali listanézetben: a sor elején jelölőnégyzet,
// a fejlécé az oldalt jelöli ki (utána a műveletsáv felajánlja az összes találatot); Shift-kattintással tartomány.
// A műveletek (állapot, letöltve, franchise, Mama, törlés) után a kijelölés megmarad; a sávban „Visszavonás”.
// A mentés címenként a saveRow sorában megy (a soron függő mentés után), de egy kéréssel: a kötegelt kérés csak
// akkor indul, amikor már minden érintett sor rá került a sorra.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  updateTitlesBatch,
  markAllSeasonsWatched,
  restoreSeasons,
  updateTitle,
  seasonAired,
  todayDate,
  mamaApplies,
  mamaLabel,
  DEFAULT_STATUS,
  DROPPED_STATUS,
} from '@/lib/titles';
import { hasSeasons } from '@/components/Seasons';
import { saveRow } from '@/lib/rowSaves';
import { toast } from '@/lib/toast';
import { article } from '@/lib/franchiseSuggest';

const TEXT_FIELD = 'input:not([type="checkbox"]):not([type="radio"]), select, textarea, [contenteditable="true"]';

// enabled: asztali listanézet, írható lista; visible / paged: a szűrt lista és az oldal bejegyzései ({ key, title, item });
// rowOf(id): a cím mostani sora a listán; show(sor): a sor kirajzolása (handleRowUpdated, kérdés nélkül);
// requestDelete(címek)
export function useBulkEdit({ enabled, visible, paged, filterKey, statuses, franchises, rowOf, show, requestDelete }) {
  const [picked, setPicked] = useState(() => new Set()); // kijelölt cím-azonosítók
  // „Mind a N találat” – csak a sáv feliratához: a kijelölés a kattintáskori találatok pillanatképe (a picked-ben), a
  // később felkerülő / visszavont cím nem kerül bele magától (K2.7)
  const [allMatches, setAllMatches] = useState(false);
  const anchor = useRef(null); // a Shift-kattintás kezdőpontja

  const visibleRows = useMemo(() => {
    const m = new Map();
    for (const e of visible) if (!m.has(e.title.id)) m.set(e.title.id, e.title);
    return m;
  }, [visible]);
  const pageIds = useMemo(() => [...new Set(paged.map((e) => e.title.id))], [paged]);

  // a kijelölésből csak a most látható címek számítanak (a törölt / kiszűrt kiesik)
  const selected = useMemo(() => {
    if (!enabled) return [];
    return [...picked].filter((id) => visibleRows.has(id)).map((id) => visibleRows.get(id));
  }, [enabled, picked, visibleRows]);
  const selectedIds = useMemo(() => new Set(selected.map((t) => t.id)), [selected]);

  function clear() {
    setPicked(new Set());
    setAllMatches(false);
    anchor.current = null;
  }

  // más szűrés / keresés: a kijelölés a még látható címekre szűkül
  const lastKey = useRef(filterKey);
  useEffect(() => {
    if (lastKey.current === filterKey) return;
    lastKey.current = filterKey;
    setAllMatches(false);
    setPicked((s) => new Set([...s].filter((id) => visibleRows.has(id))));
  }, [filterKey, visibleRows]);

  useEffect(() => {
    if (!enabled) clear();
  }, [enabled]);

  // Esc: a kijelölés megszűnik (ha nincs nyitott ablak, és nem egy mezőben / lenyílóban nyomták)
  const count = selected.length;
  useEffect(() => {
    if (count === 0) return;
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('dialog[open]') || e.target.closest?.(TEXT_FIELD)) return;
      clear();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [count]);

  // a kijelölés mostani állapota (csak a látható címek)
  const current = () => new Set(selectedIds);

  function toggle(id, shift) {
    const next = current();
    const on = !next.has(id);
    const from = shift && anchor.current != null ? pageIds.indexOf(anchor.current) : -1;
    const to = pageIds.indexOf(id);
    if (from >= 0 && to >= 0) {
      const [a, b] = from < to ? [from, to] : [to, from];
      for (const x of pageIds.slice(a, b + 1)) on ? next.add(x) : next.delete(x);
    } else if (on) next.add(id);
    else next.delete(id);
    anchor.current = id;
    setAllMatches(false);
    setPicked(next);
  }

  const pageSelected = pageIds.filter((id) => selectedIds.has(id)).length;
  const pageState = pageSelected === 0 ? 'none' : pageSelected === pageIds.length ? 'all' : 'some';

  // a fejléc jelölőnégyzete: az oldal mind ki / mind le
  function togglePage() {
    const next = current();
    if (pageState === 'all') for (const id of pageIds) next.delete(id);
    else for (const id of pageIds) next.add(id);
    setAllMatches(false);
    setPicked(next);
  }

  function selectPage() {
    const next = current();
    for (const id of pageIds) next.add(id);
    setAllMatches(false);
    setPicked(next);
  }

  function onlyPage() {
    setAllMatches(false);
    setPicked(new Set(pageIds));
  }

  // ---------- műveletek ----------

  // plan: [{ t, changes }] → kötegelt mentés a saveRow sorában; visszaad: Promise<{ done: [{ t, before }], error }>
  function saveBatch(plan) {
    if (plan.length === 0) return Promise.resolve({ done: [], error: null });
    let release;
    const gate = new Promise((r) => (release = r));
    let ready = 0;
    const result = gate.then(() => {
      // azonos módosítású címek egy kérésben
      const groups = new Map();
      for (const { t, changes } of plan) {
        const key = JSON.stringify(changes);
        if (!groups.has(key)) groups.set(key, { ids: [], changes });
        groups.get(key).ids.push(t.id);
      }
      return updateTitlesBatch([...groups.values()]);
    });
    // a mentett cím a friss sorát kapja (ha a lekérés elbukott: a módosított sort – K2.6), a nem mentett visszaáll
    const saves = plan.map(({ t, changes }) =>
      saveRow(
        t,
        (row) => withChanges(row, changes),
        () => {
          if (++ready === plan.length) release();
          return result.then(({ saved, rows }) =>
            !saved.has(t.id) ? null : rows ? (rows.get(t.id) ?? null) : withChanges(t, changes)
          );
        },
        show
      ).catch(() => null)
    );
    return Promise.all(saves).then(() =>
      result.then(({ saved, error }) => ({
        done: plan.filter(({ t }) => saved.has(t.id)).map(({ t, changes }) => ({ t, before: pick(t, changes) })),
        error,
      }))
    );
  }

  const withChanges = (row, changes) => ({
    ...row,
    ...changes,
    status_name: statuses.find((s) => s.code === (changes.status ?? row.status))?.name ?? row.status_name,
  });

  // évados sorozat „Megnézve”: minden megjelent évad megnézett (az „Abbahagyva” is feloldódik) – mint az adatlap
  // „Mind megnézve” gombja; címenként, mert az évadokat írja
  function seasonsWatched(rows) {
    return Promise.all(
      rows.map((t) => {
        const dropped = t.status === DROPPED_STATUS;
        const apply = (row) => ({
          ...row,
          status: 'watched',
          is_downloaded: false,
          seasons: row.seasons.map((s) => (seasonAired(s) ? { ...s, status: 'watched', is_downloaded: false } : s)),
        });
        return saveRow(
          t,
          apply,
          async () => {
            const done = await markAllSeasonsWatched(t);
            return dropped ? { ...done, row: await updateTitle(t.id, { status: DEFAULT_STATUS }) } : done;
          },
          show
        ).then(
          (r) => ({ t, previous: r.previous, dropped }),
          (error) => ({ error })
        );
      })
    );
  }

  function undoSeasons(items) {
    return Promise.all(
      items.map(({ t, previous, dropped }) =>
        saveRow(
          t,
          null,
          async () => {
            const row = await restoreSeasons(t.id, previous);
            return dropped ? updateTitle(t.id, { status: DROPPED_STATUS }) : row;
          },
          show
        ).catch((error) => ({ error }))
      )
    );
  }

  // what: 'status' | 'download' | 'mama' | 'franchise'; value: az új érték
  async function apply(what, value) {
    const rows = selected;
    const plan = []; // [{ t, changes }]
    const seasonRows = []; // évados sorozat → „Megnézve”
    let skipped = 0;
    for (const t of rows) {
      const c = changesFor(t, what, value);
      if (c === 'skip') skipped++;
      else if (c === 'seasons') seasonRows.push(t);
      else if (c) plan.push({ t, changes: c });
    }
    const n = plan.length + seasonRows.length;
    if (n === 0) {
      toast({ text: skipped ? `Nem változott semmi – ${skipNote(what, skipped)}.` : 'Nem változott semmi: a kijelölt címek már ilyenek.' });
      return;
    }
    const [batch, seasons] = await Promise.all([saveBatch(plan), seasonsWatched(seasonRows)]);
    const seasonsDone = seasons.filter((s) => !s.error);
    const error = batch.error ?? seasons.find((s) => s.error)?.error;
    const saved = batch.done.length + seasonsDone.length;
    // részleges hibánál is visszavonható, ami mentődött (K2.6)
    const undoAction = saved > 0 && {
      action: { label: 'Visszavonás', onClick: () => undo(batch.done, seasonsDone) },
      needsNet: 'action',
    };
    if (error) {
      toast({ text: saved > 0 ? `${saved} cím mentve, a többi nem. ${error.message}` : error.message, ...undoAction });
      return;
    }
    const lostDownload =
      what === 'status' && value === 'watched' && [...plan.map((p) => p.t), ...seasonRows].some((t) => t.is_downloaded);
    toast({
      text: (
        <>
          <b>{n} cím</b>: {resultText(what, value, franchises)}
          {lostDownload && ' – a „Letöltve” jelölés lekerült'}
          {skipped > 0 && ` · ${skipNote(what, skipped)}`}
        </>
      ),
      ...undoAction,
    });
  }

  async function undo(done, seasonsDone) {
    // a mostani sorokból (a közben máshol tett módosítás ne tűnjön el a képernyőről); a már törölt kimarad
    const now = (items) => items.map((x) => ({ ...x, t: rowOf(x.t.id) })).filter((x) => x.t);
    const plan = now(done).map(({ t, before }) => ({ t, changes: before }));
    const [batch, seasons] = await Promise.all([saveBatch(plan), undoSeasons(now(seasonsDone))]);
    const error = batch.error ?? seasons.find((s) => s?.error)?.error;
    if (error) toast({ text: `Nem sikerült mindent visszavonni. ${error.message}` });
  }

  function remove() {
    requestDelete(selected);
  }

  return {
    enabled,
    selected,
    count,
    isSelected: (id) => selectedIds.has(id),
    toggle,
    pageState,
    togglePage,
    selectPage,
    onlyPage,
    allMatches,
    selectAllMatches: () => {
      setPicked(new Set(visibleRows.keys()));
      setAllMatches(true);
    },
    matchCount: visibleRows.size,
    pageCount: pageIds.length,
    clear,
    apply,
    remove,
  };
}

const pick = (t, changes) => Object.fromEntries(Object.keys(changes).map((k) => [k, t[k] ?? null]));

// egy cím módosítása: a mentendő mezők; null – nincs változás; 'skip' – erre a címre nem vonatkozik; 'seasons' – évados
// sorozat „Megnézve”-je (az évadokat kell írni)
function changesFor(t, what, value) {
  if (what === 'status') {
    if (value === DROPPED_STATUS && t.media_type !== 'tv') return 'skip';
    if (hasSeasons(t)) {
      // az állapotot az évadok adják: az „Abbahagyva” kézi; a megnézendő / folyamatban csak az „Abbahagyva”-t oldja fel
      // (a trigger az évadokból számol)
      if (value === DROPPED_STATUS) return t.status === DROPPED_STATUS ? null : { status: DROPPED_STATUS };
      if (value === 'watched') {
        const open = t.seasons.some((s) => seasonAired(s) && s.status !== 'watched');
        if (open || t.status === DROPPED_STATUS) return 'seasons';
        // még nincs megjelent évada (csak bejelentett): nem „már ilyen”, hanem kimarad (K2.14)
        return t.status === 'watched' ? null : 'skip';
      }
      return t.status === DROPPED_STATUS ? { status: value } : 'skip';
    }
    if (t.status === value) return null;
    return {
      status: value,
      // mint a sorban: megnézettnél a mai nap; megnézettre állításkor a „Letöltve” lekerül (a trigger is leveszi)
      watched_at: value === 'watched' ? (t.watched_at ?? todayDate()) : null,
      ...(value === 'watched' && { is_downloaded: false }),
    };
  }
  if (what === 'download') {
    if (hasSeasons(t)) return 'skip'; // évadonként jelölhető
    return t.is_downloaded === value ? null : { is_downloaded: value };
  }
  if (what === 'mama') {
    if (value && !mamaApplies(t)) return 'skip';
    return (t.mama_status ?? null) === value ? null : { mama_status: value };
  }
  if (what === 'franchise') return (t.franchise_id ?? null) === value ? null : { franchise_id: value };
  return null;
}

function skipNote(what, n) {
  if (what === 'mama') return `${n} cím kimaradt (Mama csak a franchise nélküli filmeknél jelölhető)`;
  if (what === 'download') return `${n} évados sorozat kimaradt (ott évadonként jelölhető)`;
  return `${n} cím kimaradt (az évados sorozat állapotát az évadok adják)`;
}

function resultText(what, value, franchises) {
  if (what === 'status') {
    return { to_watch: 'Megnézendő', watching: 'Folyamatban', watched: 'Megnézve', dropped: 'Abbahagyva' }[value];
  }
  if (what === 'download') return value ? 'Letöltve' : 'Nem letöltött';
  if (what === 'mama') return value ? `Mama – ${mamaLabel(value)}` : 'Mama-jelölés törölve';
  const name = franchises.find((f) => f.id === value)?.name;
  return name ? `bekerült ${article(name)} „${name}” franchise-ba` : 'franchise nélkül';
}
