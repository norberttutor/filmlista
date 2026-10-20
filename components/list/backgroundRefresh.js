'use client';

// A fő lista háttérfrissítései (components/Watchlist.js): a friss lista betöltése után indulnak (useListData.js), és
// csak akkor kérdezik a szervert, ha van esedékes cím (lib/refreshDue.js). A franchise-logók külön (useMissingLogos).
import { useEffect, useRef } from 'react';
import {
  refreshImdbRatings,
  refreshFranchiseLogos,
  refreshSeasons,
  refreshBackdrops,
  refreshReleases,
  refreshTitleCollections,
  refreshDetails,
  refreshCollectionParts,
} from '@/lib/titles';
import { loadFollowed, refreshPeople } from '@/lib/people';

// titles / franchises: a most betöltött sorok; setTitles: a lista állapota; reloadNotifications: az értesítések
// újratöltése; isCancelled: a betöltés elavult (újabb indult, vagy kilépés) – a frissítések körönként nézik (kódaudit #30)
export function startBackgroundRefresh({ titles, franchises, setTitles, reloadNotifications, isCancelled }) {
  // a frissített sorok mezői a meglévőre (merge), vagy a változott címek teljes sora (replace)
  const merge = (rows) => {
    if (isCancelled()) return;
    const byId = new Map(rows.map((r) => [r.id, r]));
    setTitles((ts) => ts.map((t) => (byId.has(t.id) ? { ...t, ...byId.get(t.id) } : t)));
  };
  const replace = (rows) => {
    if (isCancelled()) return;
    const byId = new Map(rows.map((r) => [r.id, r]));
    setTitles((ts) => ts.map((t) => byId.get(t.id) ?? t));
  };

  // hiányzó / régi IMDb-értékelések pótlása a háttérben; hiba esetén csak a konzolba ír
  refreshImdbRatings(titles, merge, isCancelled).catch((err) =>
    console.warn('IMDb-értékelések frissítése sikertelen:', err.message)
  );

  // a szerkesztő ablak háttérképei a háttérben (a még meg nem nézett címekhez)
  refreshBackdrops(titles, merge, isCancelled).catch((err) =>
    console.warn('Háttérképek lekérése sikertelen:', err.message)
  );

  // a filmek TMDB-gyűjteménye a háttérben (a franchise-javaslathoz, terv-3 35)
  refreshTitleCollections(titles, merge, isCancelled).catch((err) =>
    console.warn('TMDB-gyűjtemények lekérése sikertelen:', err.message)
  );

  // a címek TMDB-adatai (magyar cím, leírás, borító, műfajok) a háttérben – a bejelentett / friss
  // címeké később érkezik a TMDB-re (terv-3 83); a változott címek teljes sora jön
  refreshDetails(titles, replace, isCancelled).catch((err) =>
    console.warn('A TMDB-adatok frissítése sikertelen:', err.message)
  );

  // sorozatok évadai a háttérben: a még évad nélküliek megkapják, a hetente
  // ellenőrzöttekhez az új (megjelent / bejelentett) évad felkerül
  // értesítések: rögtön, és az évad- / megjelenésfrissítés után újra, ha az változtatott
  // valamit (az új évadokról, digitális megjelenésről is szóljon; ha nem változott semmi,
  // az újratöltés ugyanazt adná – 3 adatbázis-kérés megspórolva). Hibánál is újratölt
  // (egy korábbi adag addig már frissülhetett).
  reloadNotifications();

  refreshSeasons(titles, replace, isCancelled).then(
    (count) => count > 0 && reloadNotifications(),
    (err) => {
      console.warn('Évadok frissítése sikertelen:', err.message);
      reloadNotifications();
    }
  );

  // filmek megjelenési dátumai a háttérben (a még meg nem jelent filmek jelvényéhez); ha
  // közben valamelyik digitálisan megjelent, a harang is szól róla
  refreshReleases(titles, merge, isCancelled).then(
    (count) => count > 0 && reloadNotifications(),
    (err) => {
      console.warn('Megjelenési dátumok frissítése sikertelen:', err.message);
      reloadNotifications();
    }
  );

  // új rész a franchise-ok TMDB-gyűjteményeiben (terv-3 36): hetente; ha jött új, a harang szól
  refreshCollectionParts(franchises, isCancelled).then(
    (count) => count > 0 && reloadNotifications(),
    (err) => console.warn('A gyűjtemények új részeinek ellenőrzése sikertelen:', err.message)
  );

  // a követett színészek / rendezők (M4): betöltés, aztán hetente az új filmjeik; ha jött új, a harang szól
  loadFollowed()
    .then(() => !isCancelled() && refreshPeople(isCancelled))
    .then(
      (count) => count > 0 && reloadNotifications(),
      (err) => console.warn('A követett személyek ellenőrzése sikertelen:', err.message)
    );
}

// hiányzó franchise-logók (a franchise első filmjének címlogója) a háttérben: betöltéskor, és
// rögtön, amikor egy logó nélküli franchise-hoz az első cím bekerül (gyűjtemény, adatlap, sor,
// tömeges import) – nem csak a következő betöltéskor. Kis várakozással, hogy az egymás után
// felvett címek egy kérésbe essenek; franchise-onként munkamenetenként egyszer (ha a TMDB-n nincs
// logó, a szerver 7 napig nem próbálja újra). enabled: betöltve, nem csak olvasható.
export function useMissingLogos(enabled, titles, franchises, setFranchises) {
  // a franchise-logó keresése ezeknél már elindult ebben a munkamenetben
  const logoTried = useRef(new Set());
  const logoDue = !enabled
    ? ''
    : (() => {
        const used = new Set(titles.map((t) => t.franchise_id).filter(Boolean));
        return franchises
          // '' – kézzel „Csak a név” (átnézés J8): nem keresünk hozzá logót
          .filter((f) => f.logo_path == null && used.has(f.id) && !logoTried.current.has(f.id))
          .map((f) => f.id)
          .join(',');
      })();
  useEffect(() => {
    if (!logoDue) return;
    const timer = setTimeout(() => {
      for (const id of logoDue.split(',')) logoTried.current.add(Number(id));
      refreshFranchiseLogos()
        .then((rows) => {
          if (rows.length === 0) return;
          const byId = new Map(rows.map((r) => [r.id, r.logo_path]));
          setFranchises((fs) => fs.map((f) => (byId.has(f.id) ? { ...f, logo_path: byId.get(f.id) } : f)));
        })
        .catch((err) => console.warn('Franchise-logók lekérése sikertelen:', err.message));
    }, 1500);
    return () => clearTimeout(timer);
  }, [logoDue]);
}
