'use client';

// A fő lista módosításai (components/Watchlist.js): a mentett / felvett / törölt címek a helyi listán, a „Hogy
// tetszett?” kérdés, a franchise-javaslat felvétel után, a franchise-ok létrehozása / átnevezése / törlése.
import { useEffect, useRef } from 'react';
import StarRating from '@/components/StarRating';
import {
  updateTitle,
  deleteTitle,
  deleteTitles,
  registerPendingDelete,
  unregisterPendingDelete,
  createFranchise,
  freshTitleRow,
  freshTitleRows,
  deleteFranchise,
  renameFranchise,
} from '@/lib/titles';
import { toast, dismissToast } from '@/lib/toast';
import { afterDialogs } from '@/lib/afterDialogs';
import { article, collectionFranchiseMap, suggestedFranchiseId } from '@/lib/franchiseSuggest';
import { isOptimistic, noteLocalWrite, saveRow } from '@/lib/rowSaves';
import { byName, frKey } from '@/components/list/useListData';

const TOAST_THUMB = 'https://image.tmdb.org/t/p/w92';

// data: useListData.js; keepShown / releaseFranchise: useListFilters.js; openFranchises: a Franchise-ok ablak
export function useListChanges({ data, keepShown, releaseFranchise, openFranchises }) {
  const { setTitles, titlesRef, franchises, setFranchises, setOrders } = data;

  // a nyitott szerkesztő ablak is a friss sort kapja (pl. évadok változása után); a sor a
  // szűrés változásáig a helyén marad – de csak ha eddig is látszott (keepShown). A közben induló újratöltés nem írja
  // felül (B1; az élő szinkronnal érkezettet sem – R2)
  function replaceTitle(row) {
    noteLocalWrite(row.id);
    setTitles((ts) => ts.map((x) => (x.id === row.id ? row : x)));
    keepShown(row);
    // más franchise-ba került: a régi sorrendből kikerült (az adatbázis-trigger is ezt teszi) – csak a
    // mentett váltásnál; az optimistánál nem, mert ha a mentés elbukik, a hely elveszne (kódaudit #21)
    if (isOptimistic(row)) return;
    setOrders((os) =>
      os.some((o) => o.title_id === row.id && o.franchise_id !== row.franchise_id)
        ? os.filter((o) => o.title_id !== row.id || o.franchise_id === row.franchise_id)
        : os
    );
  }

  // a franchise nézési sorrendje mentve (rows: az új sorok; üres: megjelenés szerint)
  function handleOrderChanged(franchiseId, rows) {
    setOrders((os) => [...os.filter((o) => o.franchise_id !== franchiseId), ...rows]);
  }

  // az IMDb-importból beírt csillagok helyben is
  function applyRatingsLocally(changes) {
    const byId = new Map(changes.map((c) => [c.id, c.to]));
    for (const id of byId.keys()) noteLocalWrite(id);
    setTitles((ts) => ts.map((t) => (byId.has(t.id) ? { ...t, my_rating: byId.get(t.id) } : t)));
  }

  // törlés visszavonással: a cím azonnal lekerül, az adatbázisból csak a sáv lejártakor (8 mp)
  // vagy a × gombra törlődik; „Visszavonás”: vissza a listára. Ha a lapot közben bezárják, a cím
  // megmarad (biztonságos hiba). A sáv csak akkor jön, ha már nincs nyitott ablak (B2): a Színészek és
  // rendezők / Toplisták fölött nyitott adatlapból törölve a „Visszavonás” az ablak mögött nem volna
  // kattintható, és a visszaszámlálás közben lejárna – addig a törlés függőben marad.
  const waitingDeletes = useRef(new Set()); // a sávra (az ablakok bezárására) váró törlések lemondói
  useEffect(() => {
    const waiting = waitingDeletes.current;
    return () => {
      // kilépéskor a függő törlés elmarad (mint a lap bezárásakor – lib/toast.js clearToasts)
      for (const stop of waiting) stop();
      waiting.clear();
    };
  }, []);

  // target: egy cím, vagy (tömeges törlés, terv-3 145) címek tömbje – egy sávval, egyben visszavonható
  function requestDelete(target) {
    const list = Array.isArray(target) ? target : [target];
    if (list.length === 0) return;
    const gone = new Map(list.map((t) => [t.id, t])); // a még függő törlések (az újra felvett kikerül)
    setTitles((ts) => ts.filter((x) => !gone.has(x.id)));
    // visszavonáskor a törléskori sor jön vissza, utána a friss: a függő törlés alatt érkezett távoli változást (pl. Mama
    // jelölését) az élő szinkron kihagyta (R17)
    const restore = () => {
      const back = [...gone.values()];
      setTitles((ts) => [...back.filter((t) => !ts.some((x) => x.id === t.id)), ...ts]);
      const apply = (row) => {
        if (!row || !titlesRef.current.some((x) => x.id === row.id)) return;
        titlesRef.current = titlesRef.current.map((x) => (x.id === row.id ? row : x));
        replaceTitle(row);
      };
      // több cím: egy lekéréssel (200-asával), nem címenként (K2.9)
      if (back.length === 1) freshTitleRow(back[0].id).then(apply);
      else freshTitleRows(back.map((t) => t.id)).then((rows) => rows?.forEach(apply));
    };
    let toastId = 0;
    let stopWaiting = null; // (nyitott ablak nélkül az afterDialogs rögtön hív – a lemondó ekkor még nincs meg)
    stopWaiting = afterDialogs(() => {
      toastId = showDeleteToast(list, gone, restore);
      if (stopWaiting) waitingDeletes.current.delete(stopWaiting);
    });
    if (!toastId) waitingDeletes.current.add(stopWaiting);
    // ha közben újra felveszed (kereső, Felfedezés…): az ő törlése elmarad, a sort a felvétel (handleAdded) teszi
    // vissza (kódaudit #22); ha már egy sem maradt, a sáv is eltűnik
    for (const t of list) {
      registerPendingDelete(t, () => {
        unregisterPendingDelete(t);
        gone.delete(t.id);
        if (gone.size > 0) return;
        stopWaiting();
        waitingDeletes.current.delete(stopWaiting);
        if (toastId) dismissToast(toastId);
      });
    }
  }

  function showDeleteToast(list, gone, restore) {
    const release = () => {
      for (const t of gone.values()) unregisterPendingDelete(t);
    };
    return toast({
      kind: 'delete',
      text:
        list.length === 1 ? (
          <>
            „<b>{list[0].title}</b>” lekerült a listáról
          </>
        ) : (
          <>
            <b>{list.length} cím</b> lekerült a listáról
          </>
        ),
      action: {
        label: 'Visszavonás',
        onClick: () => {
          release();
          restore();
        },
      },
      onExpire: () => {
        release();
        const ids = [...gone.keys()];
        if (ids.length === 0) return;
        for (const id of ids) noteLocalWrite(id); // a közben induló újratöltés válasza ne hozza vissza (B1)
        (ids.length === 1 ? deleteTitle(ids[0]) : deleteTitles(ids)).catch((err) => {
          // a részleges hibánál a már törölt címek nem jönnek vissza (K2.8)
          for (const id of err.deleted ?? []) gone.delete(id);
          restore();
          const what = ids.length === 1 ? `„${gone.get(ids[0]).title}”` : `${gone.size} címet`;
          toast({ text: `Nem sikerült törölni: ${what}. ${err.message}` });
        });
      },
    });
  }

  // a táblázatban (sor vagy évadok) Megnézve-re váltott, még értékelés nélküli címnél
  // megkérdezzük, hogy tetszett (a szerkesztő ablakban nem: ott a csillagsor kéznél van).
  // A sor kétszer jön (azonnal, majd a mentett): a ref már az elsőt látja, így csak egyszer kérdez.
  // ask: false – a gyűjtemény-ablak nézési sorrendjéből (az ablak alatt a sáv nem kattintható,
  // ott a tétel alatt kérdez). A „Hogy tetszett?” csak a mentett sorra jön (S11): az optimistánál
  // megjegyzi (askAfterSave), és ha a mentés elbukik, nem kérdez
  const askAfterSave = useRef(new Set());
  function handleRowUpdated(row, ask = true) {
    const before = titlesRef.current.find((x) => x.id === row.id);
    const turned = before && before.status !== 'watched' && row.status === 'watched' && !row.my_rating;
    if (ask && isOptimistic(row)) {
      if (turned) askAfterSave.current.add(row.id);
    } else if (ask && (turned || askAfterSave.current.has(row.id))) {
      askAfterSave.current.delete(row.id);
      if (row.status === 'watched' && !row.my_rating) askRating(row);
    }
    titlesRef.current = titlesRef.current.map((x) => (x.id === row.id ? row : x));
    replaceTitle(row);
  }

  function askRating(t) {
    let id = 0;
    const rate = async (n) => {
      dismissToast(id);
      try {
        // optimista, a cím többi mentésével sorban (S11)
        const current = titlesRef.current.find((x) => x.id === t.id) ?? t;
        await saveRow(
          current,
          (r) => ({ ...r, my_rating: n }),
          () => updateTitle(t.id, { my_rating: n }),
          (r) => handleRowUpdated(r, false)
        );
      } catch (err) {
        toast({ text: err.message });
      }
    };
    id = toast({
      kind: 'rating',
      image: t.poster_path ? TOAST_THUMB + t.poster_path : null,
      text: (
        <>
          Megnézted: <b>{t.title}</b>. Hogy tetszett?
        </>
      ),
      content: <StarRating name={`ask-${t.id}`} label={`Értékelés – ${t.title}`} value={null} onChange={rate} />,
      needsNet: 'content',
      action: { label: 'Később', onClick: () => {} },
      hideClose: true,
    });
  }

  // új cím a listán (kereső, Felfedezés, adatlap, Hasonló címek, gyűjtemény, importok). Ha franchise
  // nélküli film, és a TMDB-gyűjteménye egy franchise-odé, az app felajánlja (terv-3 35, Norbi
  // döntése: magától nem rendeli hozzá): a felvételek kis szünete után egy sáv – egy filmnél
  // „Hozzárendelés”, többnél (pl. tömeges import) „Megnézés” → a Franchise-ok ablak javaslatai.
  // Nyitott ablak (adatlap, import) fölött a sáv nem kattintható: a bezárásáig vár.
  const franchisesRef = useRef(franchises);
  useEffect(() => {
    franchisesRef.current = franchises;
  }, [franchises]);
  const pendingSuggest = useRef([]); // a felajánlásra váró címek azonosítói
  const suggestTimer = useRef(0);
  const flushSuggestRef = useRef(null);
  flushSuggestRef.current = flushSuggestions;

  function handleAdded(row) {
    // (a visszavont törlésnél a sor esetleg már a listán van – nem kerül fel kétszer)
    noteLocalWrite(row.id);
    titlesRef.current = [row, ...titlesRef.current.filter((x) => x.id !== row.id)];
    setTitles((ts) => [row, ...ts.filter((x) => x.id !== row.id)]);
    // „Már láttam” (terv-3 80): megnézettként felvett, értékelés nélküli cím – rögtön kérdezünk (nyitott ablak
    // fölött a sáv nem kattintható: ott az adatlap / a színész lapja jelzi)
    if (row.status === 'watched' && !row.my_rating && !document.querySelector('dialog[open]')) askRating(row);
    if (row.media_type !== 'movie' || row.franchise_id != null || row.tmdb_collection_id == null) return;
    pendingSuggest.current.push(row.id);
    clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => flushSuggestRef.current(), 1200);
  }

  useEffect(() => {
    // egy ablak bezárult: ha vár felajánlás, most jöhet (a 'close' nem buborékol, ezért elkapva)
    const onClose = () => {
      if (pendingSuggest.current.length === 0) return;
      clearTimeout(suggestTimer.current);
      suggestTimer.current = setTimeout(() => flushSuggestRef.current(), 300);
    };
    document.addEventListener('close', onClose, true);
    return () => {
      document.removeEventListener('close', onClose, true);
      clearTimeout(suggestTimer.current);
    };
  }, []);

  function flushSuggestions() {
    if (document.querySelector('dialog[open]')) return; // a bezáráskor újra
    const ids = pendingSuggest.current;
    pendingSuggest.current = [];
    const map = collectionFranchiseMap(titlesRef.current, franchisesRef.current);
    // a friss sorokból: közben kézzel beállított franchise-nál már nem kérdez
    const items = ids
      .map((id) => titlesRef.current.find((t) => t.id === id))
      .filter(Boolean)
      .map((t) => ({ t, f: franchisesRef.current.find((f) => f.id === suggestedFranchiseId(t, map)) }))
      .filter((x) => x.f);
    if (items.length > 1) {
      toast({
        text: `${items.length} új film egy franchise-odba tartozik`,
        action: { label: 'Megnézés', onClick: openFranchises },
      });
    } else if (items.length === 1) {
      const { t, f } = items[0];
      toast({
        image: t.poster_path ? TOAST_THUMB + t.poster_path : null,
        text: (
          <>
            „<b>{t.title}</b>” – {article(f.name)} <b>{f.name}</b> franchise-ba tartozik?
          </>
        ),
        action: { label: 'Hozzárendelés', onClick: () => assignFranchise(t, f) },
        needsNet: 'action',
      });
    }
  }

  async function assignFranchise(t, f) {
    try {
      handleRowUpdated(await updateTitle(t.id, { franchise_id: f.id }), false);
      toast({
        text: (
          <>
            „<b>{t.title}</b>” bekerült {article(f.name)} <b>{f.name}</b> franchise-ba
          </>
        ),
      });
    } catch (err) {
      toast({ text: err.message });
    }
  }

  async function handleCreateFranchise(name) {
    const created = await createFranchise(name);
    noteLocalWrite(frKey(created.id));
    setFranchises((fs) => [...fs, created].sort(byName));
    return created;
  }

  async function handleRenameFranchise(id, name) {
    const renamed = await renameFranchise(id, name);
    noteLocalWrite(frKey(id));
    setFranchises((fs) => fs.map((f) => (f.id === id ? { ...f, name: renamed.name } : f)).sort(byName));
  }

  async function handleDeleteFranchise(id) {
    await deleteFranchise(id);
    noteLocalWrite(frKey(id));
    setFranchises((fs) => fs.filter((f) => f.id !== id));
    setOrders((os) => os.filter((o) => o.franchise_id !== id));
    // az adatbázis már üresre állította a címeknél, itt csak helyben követjük
    setTitles((ts) => ts.map((t) => (t.franchise_id === id ? { ...t, franchise_id: null } : t)));
    releaseFranchise((value) => value === String(id));
  }

  // a franchise adatai (logó, gyűjtemények) a gyűjtemény-ablakból / a Franchise-ok ablakból
  function handleFranchiseUpdated(f) {
    noteLocalWrite(frKey(f.id));
    setFranchises((fs) => fs.map((x) => (x.id === f.id ? { ...x, ...f } : x)));
  }

  return {
    replaceTitle,
    handleRowUpdated,
    handleAdded,
    requestDelete,
    applyRatingsLocally,
    handleOrderChanged,
    handleCreateFranchise,
    handleRenameFranchise,
    handleDeleteFranchise,
    handleFranchiseUpdated,
  };
}
