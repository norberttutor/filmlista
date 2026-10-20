'use client';

// A fő lista módosításai (components/Watchlist.js): a mentett / felvett / törölt címek a helyi listán, a „Hogy
// tetszett?” kérdés, a franchise-javaslat felvétel után, a franchise-ok létrehozása / átnevezése / törlése.
import { useEffect, useRef } from 'react';
import StarRating from '@/components/StarRating';
import {
  updateTitle,
  deleteTitle,
  registerPendingDelete,
  unregisterPendingDelete,
  createFranchise,
  deleteFranchise,
  renameFranchise,
} from '@/lib/titles';
import { toast, dismissToast } from '@/lib/toast';
import { article, collectionFranchiseMap, suggestedFranchiseId } from '@/lib/franchiseSuggest';
import { isOptimistic, saveRow } from '@/lib/rowSaves';
import { byName } from '@/components/list/useListData';

const TOAST_THUMB = 'https://image.tmdb.org/t/p/w92';

// data: useListData.js; keepShown / releaseFranchise: useListFilters.js; openFranchises: a Franchise-ok ablak
export function useListChanges({ data, keepShown, releaseFranchise, openFranchises }) {
  const { setTitles, titlesRef, franchises, setFranchises, setOrders } = data;

  // a nyitott szerkesztő ablak is a friss sort kapja (pl. évadok változása után); a sor a
  // szűrés változásáig a helyén marad – de csak ha eddig is látszott (keepShown)
  function replaceTitle(row) {
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
    setTitles((ts) => ts.map((t) => (byId.has(t.id) ? { ...t, my_rating: byId.get(t.id) } : t)));
  }

  // törlés visszavonással: a cím azonnal lekerül, az adatbázisból csak a sáv lejártakor (8 mp)
  // vagy a × gombra törlődik; „Visszavonás”: vissza a listára. Ha a lapot közben bezárják, a cím
  // megmarad (biztonságos hiba).
  function requestDelete(t) {
    setTitles((ts) => ts.filter((x) => x.id !== t.id));
    const restore = () => setTitles((ts) => (ts.some((x) => x.id === t.id) ? ts : [t, ...ts]));
    const toastId = toast({
      kind: 'delete',
      text: (
        <>
          „<b>{t.title}</b>” lekerült a listáról
        </>
      ),
      action: {
        label: 'Visszavonás',
        onClick: () => {
          unregisterPendingDelete(t);
          restore();
        },
      },
      onExpire: () => {
        unregisterPendingDelete(t);
        deleteTitle(t.id).catch((err) => {
          restore();
          toast({ text: `Nem sikerült törölni: „${t.title}”. ${err.message}` });
        });
      },
    });
    // ha közben újra felveszed (kereső, Felfedezés…): a törlés elmarad, a sávot eltüntetjük, a
    // sort a felvétel (handleAdded) teszi vissza (kódaudit #22)
    registerPendingDelete(t, () => {
      unregisterPendingDelete(t);
      dismissToast(toastId);
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
    setFranchises((fs) => [...fs, created].sort(byName));
    return created;
  }

  async function handleRenameFranchise(id, name) {
    const renamed = await renameFranchise(id, name);
    setFranchises((fs) => fs.map((f) => (f.id === id ? { ...f, name: renamed.name } : f)).sort(byName));
  }

  async function handleDeleteFranchise(id) {
    await deleteFranchise(id);
    setFranchises((fs) => fs.filter((f) => f.id !== id));
    setOrders((os) => os.filter((o) => o.franchise_id !== id));
    // az adatbázis már üresre állította a címeknél, itt csak helyben követjük
    setTitles((ts) => ts.map((t) => (t.franchise_id === id ? { ...t, franchise_id: null } : t)));
    releaseFranchise((value) => value === String(id));
  }

  // a franchise adatai (logó, gyűjtemények) a gyűjtemény-ablakból / a Franchise-ok ablakból
  function handleFranchiseUpdated(f) {
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
