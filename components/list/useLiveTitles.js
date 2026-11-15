'use client';

// Élő szinkron a gépek között a fő listán (terv-3 86, lib/liveSync.js; components/Watchlist.js): a másik eszközön
// (vagy Mama oldalán) változott címek sorát a nézetből újratölti; a saját mentés visszhangja (ugyanaz a sor) nem
// változtat semmit, a még függő mentésű (lib/rowSaves.js – a válasza úgyis a friss sort hozza) és a visszavonható
// törlésű cím kimarad.
import { useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { isPendingDelete } from '@/lib/titles';
import { loadNotifications } from '@/lib/notifications';
import { useLiveSync } from '@/lib/liveSync';
import { hasPendingSave, noteLocalWrite, writeMark, writtenSince } from '@/lib/rowSaves';
import { byName, loadFranchises } from '@/components/list/useListData';
import { NO_FRANCHISE } from '@/components/list/listFilters';

// az élő szinkron egy kérésben legfeljebb ennyi címet tölt újra (S8)
const SYNC_CHUNK = 500;
// ha a jelzés utáni lekérés hibázik, ennyiszer próbálja újra (3, 6, 9 mp múlva), utána a teljes lista csendes
// újratöltése hozza a változást (átnézés 3, R15)
const SYNC_RETRIES = 3;

// a lista sora és a nézetből újra lekért sor ugyanaz-e: kulcsonként (a JSON.stringify a kulcsok sorrendje miatt soha
// nem egyezett – minden visszhang újrarajzolt, R14). A lista sorában a leírás hiányozhat (P5 – overviews.js): az nem
// számít eltérésnek.
function sameRow(old, row) {
  const keys = new Set([...Object.keys(old), ...Object.keys(row)]);
  for (const k of keys) {
    if (k === 'overview' && !('overview' in old)) continue;
    if (JSON.stringify(old[k]) !== JSON.stringify(row[k])) return false;
  }
  return true;
}

// data: useListData.js; notes: useNotificationList.js; replaceTitle: useListChanges.js;
// releaseFranchise: useListFilters.js
export function useLiveTitles(enabled, userId, { data, notes, replaceTitle, releaseFranchise }) {
  const { titlesRef, setTitles, setFranchises, setOrders, reload } = data;
  // S8: címenként a legutóbbi újratöltés kérésének sorszáma – egy később induló, de előbb visszaérő kérés
  // friss sorát a korábbi (régebbi) válasz nem írhatja felül
  const syncAsked = useRef(new Map());
  const syncSeq = useRef(0);

  async function syncTitles(ids, deletedIds, attempt = 0) {
    const seq = ++syncSeq.current;
    const mark = writeMark(); // B1: a közben helyben mentett / felvett / törölt címet a válasz nem írja felül
    const known = (id) => titlesRef.current.some((t) => t.id === id);
    const gone = new Set(deletedIds.filter(known));
    let rows = [];
    const wanted = ids.filter((id) => !gone.has(id));
    for (const id of [...wanted, ...gone]) syncAsked.current.set(id, seq);
    // 500-asával (S8): a PostgREST kérésenként legfeljebb 1000 sort ad, és a hosszú azonosítólista az URL-t is
    // túlnövelné (pl. mentés visszaállításakor a másik gépen)
    for (let i = 0; i < wanted.length; i += SYNC_CHUNK) {
      const part = wanted.slice(i, i + SYNC_CHUNK);
      const { data, error } = await supabase.from('titles_with_genres').select('*').in('id', part);
      if (error) {
        console.warn('Élő szinkron: a címek újratöltése sikertelen:', error.message);
        if (attempt < SYNC_RETRIES) setTimeout(() => syncTitles(ids, deletedIds, attempt + 1), 3000 * (attempt + 1));
        else reload();
        return;
      }
      rows.push(...data);
      // a nálunk lévő, de a nézetből már nem jövő cím közben lekerült (a törlés jelzése elveszhetett)
      const back = new Set(data.map((r) => r.id));
      for (const id of part) if (!back.has(id) && known(id) && !hasPendingSave(id)) gone.add(id);
    }
    // amit azóta egy újabb jelzés újra kért, azt az újabb válasz intézi
    const latest = (id) => syncAsked.current.get(id) === seq;
    rows = rows.filter((r) => latest(r.id) && !writtenSince(r.id, mark));
    for (const id of gone) if (!latest(id) || writtenSince(id, mark)) gone.delete(id);
    for (const id of [...wanted, ...deletedIds]) if (latest(id)) syncAsked.current.delete(id);
    for (const row of rows) {
      if (hasPendingSave(row.id) || isPendingDelete(row.id)) continue;
      const old = titlesRef.current.find((t) => t.id === row.id);
      if (old && sameRow(old, row)) continue;
      // a szinkron hozta változást egy közben futó, régebbi csendes újratöltés se írja felül (R2 – mint a helyit)
      noteLocalWrite(row.id);
      if (old) {
        titlesRef.current = titlesRef.current.map((t) => (t.id === row.id ? row : t));
        replaceTitle(row);
      } else {
        titlesRef.current = [row, ...titlesRef.current];
        setTitles((ts) => (ts.some((t) => t.id === row.id) ? ts.map((t) => (t.id === row.id ? row : t)) : [row, ...ts]));
      }
    }
    if (gone.size) {
      for (const id of gone) noteLocalWrite(id);
      titlesRef.current = titlesRef.current.filter((t) => !gone.has(t.id));
      setTitles((ts) => ts.filter((t) => !gone.has(t.id)));
    }
  }

  useLiveSync(enabled, userId, {
    onTitles: (ids, deletedIds) => syncTitles(ids, deletedIds),
    onNotifications() {
      loadNotifications({ collect: false })
        .then((ns) => notes.setNotifications(notes.fresh(ns)))
        .catch((err) => console.warn('Élő szinkron:', err.message));
    },
    async onFranchises() {
      const { data, error } = await loadFranchises();
      if (error) {
        console.warn('Élő szinkron: a franchise-ok újratöltése sikertelen:', error.message);
        return;
      }
      setFranchises(data.sort(byName));
      // másik gépen törölt franchise (S9): a rá szűrő lista ne ragadjon be – mint a helyi törlésnél
      const exists = (value) => data.some((f) => String(f.id) === value);
      setOrders((os) => os.filter((o) => data.some((f) => f.id === o.franchise_id)));
      releaseFranchise((value) => value !== '' && value !== NO_FRANCHISE && !exists(value));
    },
    onResync: reload,
  });
}
