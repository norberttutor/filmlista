'use client';

// A fő lista adatai (components/Watchlist.js): a címek, az állapotok, a franchise-ok és a nézési sorrendek betöltése;
// offline indulás a helyben tárolt listával (terv-3 44), újrapróbálás, csendes újratöltés, helyi mentés.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { isPendingDelete } from '@/lib/titles';
import { toast } from '@/lib/toast';
import { loadNotifications } from '@/lib/notifications';
import { loadOrders } from '@/lib/watchOrder';
import { loadHidden, resetHidden } from '@/lib/hiddenSuggestions';
import { resetFollowed } from '@/lib/people';
import { fetchAll } from '@/lib/fetchAll';
import { loadSnapshot, saveSnapshot, useOnline } from '@/lib/offline';
import { useAppFreshness } from '@/lib/appVersion';
import { hasPendingSave } from '@/lib/rowSaves';
import { reportError } from '@/lib/errorLog';
import { startBackgroundRefresh } from '@/components/list/backgroundRefresh';

export const byName = (a, b) => a.name.localeCompare(b.name, 'hu');

// a tárolt listán állva (a szerver nem érhető el) ennyi időnként újrapróbálja
const RETRY_MS = 30_000;

// a teljes lista (legutóbb hozzáadott elöl): ezres adagokban, mert egy kérés legfeljebb 1000
// sort ad (lib/fetchAll.js); az id a rendezés egyértelműségéhez kell
export const loadTitles = () =>
  fetchAll(() =>
    supabase
      .from('titles_with_genres')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
  );

export const loadFranchises = () =>
  supabase.from('franchises').select('id, name, logo_path, tmdb_collection_ids, collections_checked_at');

// notes: az értesítések (useNotificationList.js) – a betöltés tölti, a helyi mentés tárolja
export function useListData(userId, notes) {
  const { notifications, setNotifications } = notes;
  const [titles, setTitles] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [orders, setOrders] = useState([]); // a franchise-ok nézési sorrendjei (franchise_order sorai)
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // offline indulás (terv-3 44): amíg a friss lista meg nem jön, a helyben tárolt látszik
  // (stale: a mentés ideje; különben null) – közben a lista csak olvasható. failed: a friss
  // betöltés nem sikerült (nincs net / a szerver nem érhető el); reloadKey: újrapróbálás
  const [stale, setStale] = useState(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reloadDone = useRef(null); // a lehúzás (terv-3 85) várja: a következő betöltés végén hívódik
  const online = useOnline();
  const readOnly = Boolean(stale) || !online;
  // a friss lista már megjött (ezután a tárolt nem írhatja felül)
  const live = useRef(false);
  const snapshotShown = useRef(false); // a tárolt lista látszik (vagy látszott)
  const loadRunning = useRef(false); // a lista betöltése folyamatban (az újrapróbálás kivárja – kódaudit #26)
  // csendes újratöltés: csontváz nélkül, a szűrők, a lapozás és a nyitott adatlap marad
  const reload = () => setReloadKey((k) => k + 1);

  // a legutóbbi címlista a mentések / az élő szinkron utáni kérdésekhez (a kezelők a sajátjukat is beleírják,
  // hogy a következő esemény már a frisset lássa)
  const titlesRef = useRef(titles);
  useEffect(() => {
    titlesRef.current = titles;
  }, [titles]);

  // kilépéskor a követések és az elrejtett ajánlások tárolója kiürül (a következő belépő ne lássa – M4);
  // a csendes újratöltés nem üríti (S5: addig az elrejtettek ne jöjjenek vissza)
  useEffect(
    () => () => {
      resetFollowed();
      resetHidden();
    },
    []
  );

  // a helyben tárolt lista: azonnal látszik, amíg a friss meg nem jön
  useEffect(() => {
    let cancelled = false;
    loadSnapshot(userId).then((snap) => {
      if (cancelled || live.current || !snap) return;
      setTitles(snap.titles);
      setStatuses(snap.statuses);
      setFranchises(snap.franchises);
      setOrders(snap.orders ?? []);
      setNotifications(snap.notifications ?? []);
      snapshotShown.current = true;
      setStale(snap.savedAt);
      setLoadError('');
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const stopped = () => cancelled; // a háttérfrissítések körönként nézik (kódaudit #30)
    loadRunning.current = true;

    async function load() {
      const [titlesRes, statusesRes, franchisesRes] = await Promise.all([
        loadTitles(),
        supabase.from('statuses').select('*').order('sort_order'),
        loadFranchises(),
      ]);
      if (cancelled) return;
      loadRunning.current = false;

      const error = titlesRes.error || statusesRes.error || franchisesRes.error;
      if (error) {
        reportError(error);
        setFailed(true);
        // ha már a tárolt vagy egy korábban betöltött friss lista látszik, az marad (S3): a tárolt mellett
        // a sáv jelzi, a friss mellett (és a lehúzásnál mindig) egy értesítés; különben hibaüzenet – a
        // tárolt lista közben még megérkezhet, az leveszi
        if (!snapshotShown.current && !live.current) {
          setLoadError(
            navigator.onLine
              ? 'Nem sikerült betölteni a listát. Ellenőrizd az internetkapcsolatot, és frissítsd az oldalt (F5).'
              : 'Nincs internetkapcsolat, és ezen az eszközön még nincs elmentett lista. Ha visszajön a net, magától betöltődik.'
          );
        } else if ((live.current && !failed) || reloadDone.current) {
          toast({
            text: 'Nem sikerült frissíteni a listát – a legutóbb betöltött látszik. Hamarosan magától újrapróbálom.',
          });
        }
      } else {
        live.current = true;
        setStale(null);
        setFailed(false);
        setLoadError('');
        // a függő (még visszavonható) törlés nem jön vissza, a függő mentésű sor a helyi marad (S6 – mint
        // az élő szinkronnál)
        setTitles((prev) => {
          const local = new Map(prev.map((t) => [t.id, t]));
          return titlesRes.data
            .filter((t) => !isPendingDelete(t.id))
            .map((t) => (hasPendingSave(t.id) && local.has(t.id) ? local.get(t.id) : t));
        });
        setStatuses(statusesRes.data);
        setFranchises(franchisesRes.data.sort(byName));
        loadOrders()
          .then((rows) => !cancelled && setOrders(rows))
          .catch((err) => console.warn('Nézési sorrendek betöltése sikertelen:', err.message));
        // „Nem érdekel” – elrejtett ajánlások (a Felfedezés és a Hasonló címek szűri)
        loadHidden().catch((err) => console.warn('Elrejtett ajánlások betöltése sikertelen:', err.message));

        // (kilépés után már nem: a háttérfrissítések végén bejelentkezés nélkül futna)
        const reloadNotifications = () =>
          !cancelled &&
          loadNotifications()
            .then((ns) => !cancelled && setNotifications(notes.fresh(ns)))
            .catch((err) => console.warn(err.message));
        startBackgroundRefresh({
          titles: titlesRes.data,
          franchises: franchisesRes.data,
          setTitles,
          reloadNotifications,
          isCancelled: stopped,
        });
      }
      setLoading(false);
      reloadDone.current?.();
      reloadDone.current = null;
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  // visszatéréskor (legalább 5 perc rejtve után) csendben újratölt – csontváz nélkül, a szűrők, a lapozás és
  // a nyitott adatlap marad –, és szól, ha közben új kiadás jött (terv-3 63)
  useAppFreshness(!loading && !readOnly && !failed, reload);

  // lehúzás frissítéshez (terv-3 85): ugyanez a csendes újratöltés; net nélkül csak szól
  function pullRefresh() {
    if (!online) {
      toast({ text: 'Nincs internetkapcsolat – a lista most nem frissíthető.' });
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      reloadDone.current?.();
      reloadDone.current = resolve;
      reload();
    });
  }

  // net nélküli időszak után (S2): ha a friss lista már látszott, egy csendes újratöltés hozza a közben
  // (másik eszközön, Mama oldalán) történt változásokat – az élő szinkron új feliratkozása ezt nem pótolja.
  // Sikertelen betöltésnél a lenti újrapróbálás intézi.
  const wasOnline = useRef(online);
  useEffect(() => {
    const back = online && !wasOnline.current;
    wasOnline.current = online;
    if (back && live.current && !failed && !loadRunning.current) reload();
  }, [online, failed]);

  // sikertelen betöltés után: ha visszajön a net, azonnal, egyébként félpercenként újrapróbálja
  useEffect(() => {
    if (!failed) return;
    // a még futó (lassú) betöltést nem dobja el – nagyon lassú netnél különben sosem érne célba (kódaudit #26)
    const retry = () => !loadRunning.current && reload();
    const timer = setInterval(retry, RETRY_MS);
    window.addEventListener('online', retry);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', retry);
    };
  }, [failed, reloadKey]);

  // a friss lista (és minden módosítása) helyben is: a következő indításkor ez látszik elsőként
  // (1,5 mp csend után; a lap elrejtésekor / bezárásakor azonnal, ha van mentetlen változás)
  const unsaved = useRef(null);
  useEffect(() => {
    if (!live.current) return;
    const data = { titles, statuses, franchises, orders, notifications };
    unsaved.current = data;
    const timer = setTimeout(() => {
      unsaved.current = null;
      saveSnapshot(userId, data);
    }, 1500);
    return () => clearTimeout(timer);
  }, [userId, titles, statuses, franchises, orders, notifications]);
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState !== 'hidden' || !unsaved.current) return;
      saveSnapshot(userId, unsaved.current);
      unsaved.current = null;
    };
    document.addEventListener('visibilitychange', flush);
    return () => document.removeEventListener('visibilitychange', flush);
  }, [userId]);

  // visszaállítás (Mentések) után: a lista, a franchise-ok és az értesítések újra az adatbázisból
  async function reloadAfterRestore() {
    const [titlesRes, franchisesRes] = await Promise.all([loadTitles(), loadFranchises()]);
    const error = titlesRes.error || franchisesRes.error;
    if (error) {
      reportError(error);
      throw new Error('A visszaállítás sikerült, de a lista nem töltődött be. Frissítsd az oldalt.');
    }
    setTitles(titlesRes.data);
    setFranchises(franchisesRes.data.sort(byName));
    loadOrders()
      .then(setOrders)
      .catch((err) => console.warn(err.message));
    loadHidden().catch((err) => console.warn(err.message));
    notes.forgetLocal();
    loadNotifications()
      .then(setNotifications)
      .catch((err) => console.warn(err.message));
  }

  return {
    titles,
    setTitles,
    titlesRef,
    statuses,
    franchises,
    setFranchises,
    orders,
    setOrders,
    loading,
    loadError,
    stale,
    failed,
    online,
    readOnly,
    reload,
    pullRefresh,
    reloadAfterRestore,
  };
}
