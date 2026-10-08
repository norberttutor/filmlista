# Filmlista – projektleírás Claude Code számára

## Kommunikáció
- A felhasználóval (Norbi) **magyarul** kommunikálj.
- Norbi SQL-ben és telefonos rendszerekben (Asterisk) jártas, a JavaScript/Next.js világ új neki.
  Röviden magyarázd el, mit és miért csinálsz, és a terminálparancsokat is írd le.
- Windowson dolgozik, VS Code-ban, a terminál alapprofilja Command Prompt (cmd).

## Mi ez?
Személyes webalkalmazás megnézendő filmek és sorozatok nyilvántartására:
borítókép, műfajok, IMDb link, állapot (megnézendő / folyamatban / megnézve), letöltve jelző.
Egyetlen felhasználó (Norbi), de az adatmodell felhasználónként elkülönít.

## Technológia
- **Next.js 16** (App Router), **JavaScript** (nem TypeScript), React 19
- **Supabase** (PostgreSQL + Auth), `@supabase/supabase-js`, kliensoldali használat
- **Vercel** hosting, a GitHub `main` ág minden push-a után automatikus deploy
  - Repó: `norberttutor/filmlista` (privát)
  - Élő oldal: https://filmlista-six.vercel.app/
- **TMDB API** a film/sorozat adatokhoz (magyar nyelv: `language=hu-HU`)
- Stílus: sima CSS az `app/globals.css`-ben (nincs Tailwind), CSS változókkal

## Környezeti változók
`.env.local` (helyben) és Vercel → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_KEY` – publishable/anon kulcs (a böngészőbe kerül, RLS véd)
- `TMDB_READ_TOKEN` – TMDB API Read Access Token, **csak szerveroldalon** használható
  (route handlerben), soha ne kapjon `NEXT_PUBLIC_` előtagot
- `OMDB_API_KEY` – OMDb API kulcs az IMDb-értékelésekhez (ingyenes, napi 1000 lekérdezés),
  szintén csak szerveroldalon. Ha hiányzik, az app értékelés nélkül működik (nincs hiba).

Csak helyben (`.env.local`), a Vercelre nem: `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`,
`MAMATEST_USER_EMAIL` / `MAMATEST_USER_PASSWORD` (második tesztfiók Mama szerepéhez – a 13-as
ponthoz, Norbi hozta létre 2026-10-07; az értékeit soha ne írd ki),
`SUPABASE_DB_URL` (admin) és `BACKUP_DB_URL` – a csak olvasó `backup_reader` szerep kapcsolata
(`munka/e2e/mentes-olvaso.mjs` állítja be); ugyanez a GitHubon is titok (Settings → Secrets and
variables → Actions → `BACKUP_DB_URL`) a heti mentés-feladathoz.

Soha ne használd a Supabase secret/service_role kulcsot a kliensben.

## Fájlszerkezet
- `app/layout.js` – Bricolage Grotesque betűtípus (`--font-main`) az optikai méret
  (`axes: ['opsz']`) tengellyel is (a nagy főcím a nagy méretre rajzolt formát kapja), `lang="hu"`;
  a böngészőfül címe „Megnézendő filmek”; a címsor színe (`viewport.themeColor`) `#1a222d` (`--bg-top`)
- `app/icon.svg` – az app ikonja (böngészőfül): sötét, lekerekített négyzeten neon türkiz
  filmcsapó. PNG-változatai: `app/apple-icon.png` (iPhone, 180 px), `public/icon-192.png`,
  `public/icon-512.png` (telepített app), `public/icon-maskable-512.png` (Android: teljes négyzet,
  a csapó a kör alakú vágáson belül). Mind egy forrásból készül: `munka/e2e/ikon.mjs` (helyi
  mappa); az ikon változtatásakor ezzel kell újragenerálni mindet
- `app/manifest.js` – webalkalmazás-manifest (`/manifest.webmanifest`): ettől telepíthető az oldal
  Chrome-ból / Edge-ből saját ablakos alkalmazásként (név: „Megnézendő filmek és sorozatok”, rövid
  név: „Megnézendő filmek”, `theme_color` = `--bg-top`). Ellenőrzés: `munka/e2e/verify-ikon.mjs`.
  Gyorsindítók (`shortcuts`, terv-3 43, 2026-10-07): jobb klikk a telepített app ikonjára (telefonon
  hosszan nyomva) – „Cím hozzáadása” / „Franchise-ok” / „Statisztika” → `/?nyit=hozzaadas` |
  `franchise-ok` | `statisztika`; a `Watchlist` a lista betöltése után egyszer megnyitja
  (`SHORTCUTS`), és a paramétert kiveszi a címből (újratöltéskor ne nyíljon újra). A már telepített
  appnál a Chrome a manifest frissülése után (néha csak az app újraindítása után) mutatja
- `app/page.js` – kliensoldali session-kezelés: belépés vagy lista. Belépés után megnézi a `list_viewers`
  saját sorát (terv-3 13): ha van (Mama – néző), `MamaView`, különben `Watchlist`; amíg nem tudja,
  „Betöltés…”; hibánál a `Watchlist` nyílik (a néző ott csak a saját üres adatait látná). A néző-e
  választ a böngésző megjegyzi (`localStorage`, `filmlista-nezo:<userId>`): a következő indításkor nem
  vár rá, net nélkül is tudja. Regisztrálja a service workert (`registerServiceWorker()`). Net nélkül,
  lejárt tokennel (vagy ha a `getSession()` 4 mp – net nélkül 0,3 mp – alatt nem válaszol: a Supabase
  ilyenkor sokáig újrapróbál) a tárolt munkamenettel (`storedSession()`, `offline: true`) a `Watchlist`
  nyílik; kilépéskor (`SIGNED_OUT`) a helyben tárolt lista törlődik (`clearSnapshots()`)
- `public/sw.js` + `lib/offline.js` – **offline indulás** (terv-3 44, 2026-10-08): service worker (csak a
  kiadott változatban; `next.config.mjs`: `/sw.js` `no-cache`): az oldal előbb a hálózatról (3 mp-es
  időkorláttal, utána / net nélkül a tárolt), a `/_next/static/` és a TMDB-képek (CORS-szal, legfeljebb
  1500) előbb a tárolóból; az `/api` és a Supabase nem. A lap betöltés után elküldi a használt
  programfájlokat (`assets` üzenet) – a régi kiadásokéi ekkor törlődnek. A tárolás módjának
  változásakor a `VERSION`-t emeld. A lista helyben: IndexedDB `filmlista` / `snapshots`,
  felhasználónként (`loadSnapshot` / `saveSnapshot` / `clearSnapshots`); `useOnline()`. Mama oldala
  (`MamaView`) nem tárol helyben: net nélkül elindul, de üres / hibát mutat
- `components/MamaView.js` + `components/MamaDetail.js` – **Mama oldala** (terv-3 13, Norbi választása:
  „B” látványterv – `munka/terv-3/terv-13/`): „Norbi filmjei”, „Kilépés”; rendezés, kereső,
  menü, harang nincs. Egy szűrő (Norbi kérése, 2026-10-07; `.mama-tabs`, darabszámmal): „Filmek” (a
  jelöletlenek – eldöntendők, alapból) / „Érdekel”; a most jelölt / visszavont sor a szűrő váltásáig a
  helyén marad (`kept`). A `mama_list()` filmjei (a legutóbb hozzáadott elöl), 24-esével „További filmek”;
  soronként borító, cím, év, műfajok, IMDb (`ImdbBadge`), 2 soros leírás (telefonon nincs) és a két
  gomb: „Érdekel” (borostyán – saját jelölés; kiválasztva „✓ Érdekel”, újra kattintva visszavonja) /
  „Nem érdekel” (a sor eltűnik, az értesítősávban „Visszavonás” – a régi helyére teszi vissza).
  Optimista mentés a `mama_mark()`-kal, hibánál visszaáll és üzen. A borítóra / címre kattintva
  **adatlap** (`MamaDetail`, `dialog.editor.mama-detail`): háttérkép, borító, cím, év, műfajok, IMDb,
  „Előzetes megnézése” (`/api/tmdb/videos`), leírás, „Hol nézhető?” (`WatchProviders`), alul a két
  nagy gomb; „Nem érdekel”-re bezárul. Kikattintásra (asztalon) / „Bezárás” (×) / Esc zár; telefonon
  alsó lap fogantyúval (lehúzva zár). Üres „Filmek”-nél „Most nincs új film, amiről kérdeznénk.”. CSS: a
  „Mama oldala” szakasz (nagyobb betűk, `.mama-*`). E2e: „Mama oldala (terv-3 13)…” (Mama-tesztfiók,
  külön böngészőablak, telefonméret)
- `components/LoginForm.js` – e-mail + jelszó belépés (regisztráció nincs, ki van kapcsolva);
  minden középen: cím, alatta az űrlap (nagyobb kijelzőn kártyán, felülről halvány türkiz fény)
- `components/Watchlist.js` – lista betöltése a `titles_with_genres` nézetből (`loadTitles()`:
  ezres adagokban – `lib/fetchAll.js`; a háttérfrissítések csak akkor hívják a szervert, ha a
  betöltött listában van esedékes cím – `lib/refreshDue.js`). **Offline** (terv-3 44): induláskor
  azonnal a helyben tárolt lista (címek, állapotok, franchise-ok, nézési sorrendek, értesítések;
  `stale` = a mentés ideje), a friss a háttérben jön („· frissítés…” a darabszám mellett); a friss
  lista és minden módosítása 1,5 mp után helyben is mentődik. Amíg a tárolt látszik vagy nincs net
  (`readOnly`): nincs „Cím hozzáadása” / „+” / gyorsgomb, a ⋮ menüből kimarad az IMDb import, a
  Tömeges import és a Mentések (`ONLINE_ONLY`), a táblázat vezérlői és az adatlap mezői tiltva (`Lock`
  – `fieldset.lock`, `display: contents`; az adatlapon csak „Bezárás”), a háttérfrissítések nem
  indulnak; net nélkül / sikertelen betöltésnél sáv (`.offline-note`): „Nincs internetkapcsolat. A lista
  a … -kor elmentett állapotot mutatja; most csak nézelődni lehet…”. Sikertelen betöltésnél a net
  visszatérésekor és félpercenként újrapróbálja (`reloadKey`). A borítófalon nincs mit tiltani (a
  kártya csak az adatlapot nyitja). Teszt: `munka/e2e/test-44.mjs`; fejléc:
  „Megnézendő filmek és sorozatok”; mellette (jobbra) „Cím hozzáadása”, harang (`NotificationBell`),
  e-mail, Kilépés, a sor végén a „További műveletek” (⋮) menü (`MoreMenu`, Norbi kérése, mint a
  Chrome-ban): „Statisztika” (`StatsDialog`), „Franchise-ok” (`FranchisesDialog`, telefonon is), „IMDb import” (telefonon – `PHONE_QUERY`, ≤ 640 px –
  nincs, Norbi kérése), asztali nézetben „Tömeges
  import” (`BulkImport`) és „Mentés letöltése” (`downloadListCsv`), utána „Mentések”
  (`BackupsDialog`, telefonon is), a végén „Felhasználói leírás” (`ManualDialog`, telefonon és net
  nélkül is). Telefonon (≤ 640 px) a
  „Cím hozzáadása” helyett lebegő, kerek „+” gomb a jobb alsó sarokban (`.fab`; lefelé
  görgetéskor elhúzódik, felfelé visszajön – ugyanaz a görgetésfigyelő, mint a szűrősoré;
  kattintva megnyitja a keresőt és a lap tetejére görget); szűrősor
  balról: Típus lenyíló (Filmek / Sorozatok; kiválasztott franchise vagy keresés
  mellett plusz „Filmek és sorozatok” – `type: 'all'`, ami franchise választásakor
  automatikusan beáll, a franchise-szűrő megszüntetésekor vissza Filmek) – állapotgombok
  (mobilon, ≤ 640 px: lenyíló a típus mellett; az „Abbahagyva” csak Sorozatok / Filmek és
  sorozatok típusnál) + Letöltés lenyíló (Összes / Letöltött / Nem letöltött) – Műfaj (csak az
  adott típus műfajai) – Mama (Összes / Érdekli / Nem érdekli / Megkapta; csak ha van Mama-jelölés) –
  Franchise (Összes / Franchise nélkül / a listán használtak, típustól
  függetlenül) – mellette felirat nélküli ↺ gomb („Szűrők alaphelyzetbe”, rámutatva súgó;
  alapállapotban halvány, letiltott). **A szűrők alapállapota** (betöltéskor és a ↺-vel,
  `DEFAULT_FILTERS`, Norbi kérése): Filmek – Megnézendő – Nem letöltött – Összes műfaj –
  Franchise nélkül;
  telefonon (≤ 640 px) a szűrők alapból összecsukva: „Szűrők” gomb, mellette röviden a beállítás
  (`filterSummary`, pl. „Filmek · Megnézendő · Nem letöltött · Franchise nélkül”), kinyitva minden
  szűrő és a rendezés; a kereső összecsukva is látszik (Norbi kérése);
  jobb szélen keresőmező („Keresés a listán”: a címben és az eredeti címben, kis-/nagybetű és
  ékezet nélkül – `fold()`; több szónál mindegyiknek szerepelnie kell; telefonon külön sorban;
  gépeléskor az egész listán keres: a szűrők félreállnak – `SEARCH_FILTERS`, keresés közben
  szűkíthetők –, a keresés törlésekor a keresés előtti szűrők állnak vissza),
  mellette felirat nélkül (`aria-label`) a Rendezés (`SORTS`:
  legutóbb / legkorábban hozzáadott, legjobb értékelés, legújabb / legrégebbi megjelenés;
  üres érték a végére; franchise-ra szűrve, ha annak van saját nézési sorrendje – terv-3 28 –, elöl
  „Nézési sorrend” (`WATCH_ORDER`): Norbi döntése, 2026-10-06, csak ilyenkor kínálja, és a franchise
  kiválasztásakor magától erre áll – `orderSort`; nézési sorrend nélküli franchise-nál magától
  „Legrégebbi megjelenés” – `FRANCHISE_SORT` –; franchise kiválasztásakor – nézési sorrendtől függetlenül – az állapotszűrő magától „Mind” – a franchise-szűrő
  megszűnésekor az előző állapot jön vissza, `statusBeforeFranchise`, kézi állapotválasztás után nem;
  Norbi kérése, 2026-10-06; kézi rendezésválasztás után az marad –, más franchise-nál / franchise nélkül az előző
  rendezés; ilyenkor a lista a sorrend tételeiből áll – `visible`: `{ key, title, item }` –: a
  sorozat évadonként külön tétel, több helyen is („2. évad” a kártyán – `.card-season` – és a soron –
  `.season-tag` –; az évadcsíkon nincs kiemelés – Norbi kérése, 2026-10-06), az állapot- és a letöltve-szűrő, a
  darabszámok és a `kept` tételenként – évadnál az évadé, abbahagyott sorozat meg nem nézett
  évadja Abbahagyva), a sor legvégén (csak ≥ 1400 px-en) felirat nélküli nézetváltó: két
  ikongomb, lista (táblázat, `TitleTable`) | rács (borítófal) – `aria-pressed`, `title`; a
  választást a böngésző megjegyzi (`localStorage`, `filmlista-nezet`), alapból lista;
  1400 px alatt mindig borítófal. Borítófal: telefonon (≤ 640 px) 3 kártya egy sorban (kisebb
  betűk és csillagok, a „Letöltve” jelvény csak ikon), asztali rácsban `minmax(185px)` kártyák, tömör
  sorközzel (1,5 rem) és margóval (mérés: `munka/dizajn-2/eszkozok/racs-meres.mjs`).
  Az állapotgombok darabszámai a többi szűrőt már figyelembe veszik.
  A most szerkesztett sor a szűrés változásáig a helyén marad (`kept`), akkor is, ha már nem
  illik a szűrőbe (pl. „Nem letöltött” nézetben letöltöttnek jelölve) – így visszavehető.
  Üres találatnál üres állapot (`EmptyState`: rajz, cím, magyarázat, gombok): keresésnél „Nincs
  „…” a listádon” + „Keresés a TMDB-n: „…”” (a Cím hozzáadása panel kitöltve nyílik –
  `openAdd(q)`, `TitleSearch initialQuery`) + „Keresés törlése” / „Szűrők törlése”; szűrésnél
  „Szűrők törlése” + „Felfedezés”; üres listánál „Első cím hozzáadása” + Tömeges import (a
  gombok neve szándékosan nem „Cím hozzáadása”: a fejléc gombjával ne ütközzön).
  Franchise-ra szűrve a lista fölött a gyűjtemény sávja (`FranchiseCollection`).
  Törlés visszavonással (`requestDelete(t)`): a cím azonnal lekerül, az értesítősávban 8 mp-ig
  „Visszavonás”; az adatbázisból csak a sáv lejártakor vagy a × gombra törlődik (ha a lapot
  közben bezárják, a cím megmarad). A táblázatból (sor vagy évadcella) Megnézve-re váltott,
  még értékelés nélküli címnél „Megnézted: … Hogy tetszett?” sáv csillagsorral és „Később”
  gombbal (`handleRowUpdated` → `askRating`; a sor kétszer jön – azonnal és mentve –, a
  `titlesRef` miatt csak egyszer kérdez; a szerkesztő ablakból nem kérdez). Az `<Toaster />`
  a `main` végén.
  Lapozás 25-ösével (`PAGE_SIZE`, `components/Pagination.js`); asztali rácsban (≥ 1400 px)
  22-esével (`GRID_PAGE_SIZE`, Norbi kérése, 2026-10-04: 1440p-n 11 oszlop × 2 teli sor), és
  ott a lapozó és alatta a lábléc az ablak alján áll (`docked` → `.pagination.docked`; a lábléc
  ilyenkor kompakt, `--docked-footer-h` = 2,75 rem magas, `sticky; bottom: 0`, a lapozó `sticky;
  bottom: var(--docked-footer-h)`, mindkettő üveg, mint a letapadt szűrősor; a `main` flex oszlop –
  a body flex oszlopában `flex: 1` –, a lapozó `margin-top: auto`): minden oldalon ugyanott, a
  lábléc mindig látszik, görgetősáv csak ha a kártyák nem férnek ki (a korábbi `min-height:
  100dvh` feleslegesen görgetett); az értesítősáv fölöttük; a
  lapozás az oldal első címének helyét jegyzi (`pageState.first`), így nézetváltáskor az az
  oldal jön, amelyiken az addig látott első cím van; szűrés/rendezés/keresés
  váltásakor 1. oldal (akkor is, ha később ugyanaz a szűrés jön vissza); lapozáskor a szűrősor
  eredeti helyére görget (egy üres jelölő a szűrősor előtt – a letapadt sorhoz nem lehetne).
  A szűrősor görgetéskor a lap tetejére tapad (`position: sticky`); letapadva (`data-stuck`, a
  Watchlist egy görgetésfigyelője jelzi) áttetsző, elmosott üveg; a magasságát
  (`--filters-h`, ResizeObserver) a táblázat ragadós fejléce kapja, hogy alatta tapadjon;
  telefonon kinyitva legfeljebb a képernyő 70%-a, belül görgethető. Letapadva (csak asztalon,
  ≥ 641 px) a ↺ után gyorsgombok (`.stuck-tools`): kerek türkiz „+” (Cím hozzáadása, a lap
  tetejére görget) és „↑” (vissza a lap tetejére)
- `components/Toaster.js` + `lib/toast.js` – értesítősáv („toast”): alul középen (telefonon a
  lebegő „+” fölött), `aria-live="polite"`; `toast({ text, image, content, action: { label,
  onClick }, hideClose, duration = 8000, onExpire })` → id, `dismissToast(id, how)`; az
  `onExpire` lejáratkor és a × gombra fut (az action-re nem); legfeljebb 3 egyszerre (a
  legrégebbi lejártként tűnik el); rámutatáskor / fókusznál megáll (a fogyó csík is)
- `components/EmptyState.js` – üres állapot: kis vonalrajz (filmkocka + nagyító, türkiz), cím,
  szöveg, a hívó gombjai
- `components/PosterCard.js` – borító (`https://image.tmdb.org/t/p/w342` + `poster_path`),
  állapotcsík, „Letöltve” jelvény; a borítóra kattintva a szerkesztő ablak nyílik (mint a
  ceruzával – Norbi kérése), az IMDb- (vagy TMDB-, ha nincs IMDb ID) adatlapra csak a cím visz
  (halvány aláhúzással), „Hozzáadva: <dátum>” a `created_at` alapján (csak megjelenítés, nem
  szerkeszthető), saját értékelés kis csillagsorként (`StarsDisplay`), ceruza gomb a bal felső
  sarokban → szerkesztő ablak (billentyűzettel / felolvasóval ez a borító-kattintás megfelelője);
  Mamából csak az „Érdekli”: borostyán „M” a borító jobb felső sarkában (`.poster-corner` > `.mama-mark`,
  a „Letöltve” jelvény mellett; a többi Mama-érték a kártyán nem látszik – a szűrő mutatja; Norbi
  választása, 2026-10-08, látványterv: `munka/terv-3/mama-ikon/`), műfajok
  színes pöttyel (`GenreList`); az első
  rámutatáskor kiszámolja a borító hangulatszínét (`usePosterColor`), rámutatva a borító ebben fénylik
  (a kurzort követő „fénylő kártyaél” 2026-10-04-én Norbi kérésére kikerült). Még meg nem
  jelent filmnél (`releaseState(t)`, `data-release`) szaggatott keret a borító körül és
  `ReleaseBadge` a borító alján (a „digitálisan: …” második sorban; telefonon csak a dátum –
  „okt. 15.” – vagy „Moziban” / „Hamarosan”; borító nélkül a helykitöltő cím feljebb csúszik)
- `components/ReleaseBadge.js` – a még meg nem jelent film jelvénye (naptár ikon, szaggatott
  keretű pirula): „Hamarosan · okt. 15.” / „Hamarosan · 2027” / „Moziban · digitálisan: nov.
  20.” vagy „… még nincs dátum”; a kártyán, a táblázat sorában (a cím adatai között) és a
  szerkesztő ablakban. Norbi döntése (2026-10-04): szűrőgomb nem kell, csak a szaggatott
  megjelenítés (+ a harang)
- `components/GenreList.js` + `lib/genreColors.js` – műfajok, mindegyik előtt kis színes pötty
  (`genreColor(név)`: OKLCH, egyforma világosság, a rokon műfajok rokon színt kapnak; ismeretlen
  műfaj szürke; a kulcs a TMDB magyar műfajneve); felolvasónak vesszővel elválasztva (`sr-only`).
  A kártyán és a táblázat sorában; megnézett / abbahagyott címnél a pötty szürke
- `lib/posterColor.js` – hangulatszín a borítóból: `usePosterColor(poster_path, enabled)` a kis
  (w92, saját gyorsítótár-kulccsal: `?szin`) borítót vászonra rajzolja (a TMDB képszervere CORS-t
  enged, de csak CORS-os kérésre: ha ugyanaz a kép CORS nélkül is a böngésző gyorsítótárában
  lenne – mint a harang w92-es képei –, a vászon tiltást kapna; a külön kulcs ezt kizárja.
  Korábban w185 volt, ~15 KB helyett most ~5 KB, terv-3 34, 2026-10-05), a legjellemzőbb élénk
  színt adja OKLCH-ban, rögzített világossággal (0,72) és telítettséggel (0,04–0,13) – így a
  szövegek olvashatósága nem változik; borítónként egyszer számol (`Map`). `ambientProps(szín)`:
  `--ambient` CSS-változó + `data-ambient` jelző; a CSS („Hangulatszín a borítóból” szakasz)
  csak ilyenkor színez: a szerkesztő ablak a borító mögül dereng (színezett keret, árnyék,
  háttér), a kártya rámutatva fénylik, a táblázat rámutatott sora halványan színeződik
- `components/TitleEditor.js` – natív `<dialog>` (fejlécben a leírás). **Adatlapok egymás mögött**
  (terv-3 31-es pont, 2026-10-05): az ablak (`TitleEditor`) lapokat tart (`stack`: `{ id, rowId, item,
  added }`), mindig az utolsó látszik, a többi rejtve megmarad (`.editor-page[hidden]`, a görgetési
  helyével); a lap sora a `titles` propból jön (a listáról nyitottnál `rowId` szerint, különben
  TMDB-azonosító szerint) – ha nincs a listán, a lap **előnézet** (`TitlePage`, `preview`): a
  `/api/tmdb/details` adataival, a szerkesztő mezők, a Mentés és a Törlés helyett „Hozzáadás a
  listához” (`addTitle(item, details)` – nem kérdez újra) és „Bezárás”; felvétel után a lap új
  kulccsal rendes adatlappá válik („✓ Felkerült a listádra”, `.added-note`; Norbi döntése: nem
  zárul be). Előnézet nyílik a Cím hozzáadása találatának borítójáról / címéről és a Felfedezés
  borítójáról (`onPreview` → `Watchlist.openEditor`), valamint a Hasonló címek borítójáról az
  ablakon belül (új lap, a cím fölött „‹ Vissza: …”, `.back-link`); a franchise-gyűjteményből és
  az importokból nem (Norbi döntése). Mentetlen módosítással a lap nem hagyható el (a hasonló cím
  és a Vissza is figyelmeztet, mint a kikattintás – az elöl lévő lap `apiRef`-en adja a
  `canLeave` / `nudge` függvényt); a Mentés / Mégse / Esc / kikattintás az egész ablakot zárja; a
  nézetváltás csak az első lapról siklik vissza; a háttérképes elrendezés jele (`.has-backdrop`)
  a lapon van, nem a `dialog`-on; a cím `id="editor-title"`-je csak a látható lapé; a rejtett
  lapon nem szól az előzetes. A listán lévő cím lapja: állapot, letöltve (a megnézés
  dátuma – `watched_at` – nem látszik és nem szerkeszthető, Norbi kérése, 2026-10-04: megnézettre
  állításkor a háttérben a mai nap kerül be, a Statisztika és a CSV használja), értékelés 10 csillaggal
  (+ „Törlés” link), törlés megerősítéssel – Norbi kérésére itt marad –, utána a sávban 8 mp-ig
  „Visszavonás” (`onDelete` → `Watchlist.requestDelete`) (a mobilos borítófalon a borító vagy a
  ceruza nyitja). Az „Abbahagyva” állapot csak sorozatnál választható. Alul „Hasonló címek”
  (`SimilarTitles`). Előzetes: megnyitáskor a háttérben `/api/tmdb/videos`; ha van, a cím
  adatai alatt „Előzetes megnézése” (angolnál „angolul” jelzés) → 16:9 YouTube-lejátszó
  (`youtube-nocookie.com`, `.trailer`), „Előzetes bezárása”. Évados sorozatnál az Évadok
  fölött az idővonal (`SeasonTimeline`; a pöttyre kattintva a lista az évadhoz görget).
  Asztalon (≥ 900 px) széles (66 rem – így a vezérlősáv egy sorba fér, Norbi kérése, 2026-10-08),
  kétoszlopos ablak: balra nagy borító (w500, görgetéskor a helyén
  marad; borító nélkül filmikon), jobbra az adatok; telefonon egy oszlop, nagy borító nélkül.
  Nézetváltás (asztalon, `lib/viewTransition.js`): a kattintott kártya / sor borítója átsiklik a
  nagy borító helyére (a `Watchlist` `openEditor(t, forrásElem)` indítja), bezáráskor (Esc –
  `cancel` elkapva –, Mégse, Mentés) a `morphTo` borítóra vissza; törléskor nincs. A
  `showModal()` ezért `useLayoutEffect`-ben fut.
  Kikattintás (Norbi kérése, 2026-10-04; `useBackdropClose`): asztalon (≥ 641 px) a háttérre kattintva bezárul
  (`isOutside`: a cél maga a `dialog`, a pont a téglalapján kívül; a `pointerdown` is kívül –
  a kifelé húzott kijelölés nem zár), kivéve, ha mentetlen módosítás van (`dirty`: a Mentés
  által küldött mezők eltérnek a megnyitáskoritól – `initial`; az évadok nem számítanak):
  ilyenkor `.unsaved-hint` („Mentetlen módosítás – Mentés vagy Mégse”, `role="status"`, mindig a
  lapon) és a „Mentés” türkiz gyűrűt kap (`.attention`, 450 ms). Nem zár akkor sem, ha a törlés
  megerősítése nyitva van, vagy a FranchiseSelect új név / átnevezés módban van
  (`.franchise-new`). Telefonon (alsó lap) nem zár; az Esc mindig zár.
  Megnyitáskor a fókusz az ablak címén van (keret nélkül), nem a Franchise mezőn (Norbi kérése).
  Ha van háttérképe (`backdrop_path`), az ablak tetején a film széles jelenetképe (`w1280`,
  telefonon `w780`), alul a felületbe olvadva; asztalon a nagy borító ráúszik a kép aljára
  (`.has-backdrop`). Telefonon (≤ 640 px) az ablak alsó lap: alulról felcsúszik, teljes
  szélességű, felül fogantyú (`.sheet-handle`) – lefelé húzva (110 px vagy gyors mozdulat)
  bezárul, különben visszaugrik.
  **Tömör elrendezés** (terv-3 30, B – „vezérlősáv”, Norbi választása, 2026-10-05): fölül a
  Franchise és a Saját értékelés egymás mellett (`.editor-pair`), alatta keretes sáv
  (`.editor-controls`): Állapot | Letöltve | Mama, elválasztóvonalakkal (évados sorozatnál az
  Évadok a sáv fölött, a sávban csak a Mama; asztalon egy sorban; a csoportok – telefonon is – középre zárva); a mezők címkéi kis, ritkított nagybetűk; telefonon
  a pár egymás alatt, a sávban fent az Állapot, alatta a Letöltve és a Mama. Asztalon a
  vezérlőblokk 341 → 168 px (látványtervek: `munka/terv-3/terv-30/`).
  A borító hangulatszínét megnyitáskor kiszámolja (`usePosterColor`): az ablak a film színében
  dereng. A kiválasztott Mama borostyán (`.mama-chips`).
  Évados
  sorozatnál az állapot / letöltve / dátum helyett „Évadok” lista (`SeasonList`), ami azonnal
  ment (`onChanged`); a „Mentés” ilyenkor nem küld `status` / `is_downloaded` / `watched_at`-et
- `components/Seasons.js` – évadok (sorozatoknál): `hasSeasons()`, `seasonCounts()`,
  `seasonRange()` („1–3., 5.”), `useSeasonActions()` (optimista mentés, hibánál visszaáll;
  megnézettre állításkor az előtte lévő üres évadok is megnézettek lesznek, 10 mp-ig
  „Visszavonás”), `SeasonStrip` (évadonként egy szakasz az állapotszínnel; a bejelentett –
  jövőbeli / dátum nélküli – szaggatott, nem jelölhető; táblázatban kattintásra lépteti:
  üres → Folyamatban → Megnézve → üres), `SeasonList` (évadonként állapot + „Letöltve”,
  „Mind megnézve”, „Nem nézem tovább” / „Mégis folytatom” (ugyanaz a gomb vált feliratot),
  `SeasonTimeline` (szerkesztő ablak, ≥ 2 évad: évadonként egy pötty-gomb a megjelenés napján
  az állapot színével, bejelentett szaggatott, „ma” jelölő; a tengely legfeljebb egy évvel tart
  a mán / az utolsó megjelent évadon túl – a dátum nélküli fél évvel utána, a távolabbi a
  végén áll, a címkéjében a valódi dátum; 12 évnél hosszabb tengelyen minden 2. évszám),
  „+ Évad hozzáadása”, „Utolsó évad törlése” megerősítéssel – ha a TMDB-n is
  szerepel, a heti frissítés üresen visszahozza; abbahagyott sorozatnál a lista tetején lila
  sáv), `SeasonCell` (táblázat Állapot cellája: csík + „x/y évad”, ami lenyíló panelt nyit,
  alatta „Abbahagyva”, ha az; kívülre kattintás / Esc bezár), `SeasonDownloads`
  (Letöltve cella: a letöltött évadok). „Abbahagyva” (sorozat, amit Norbi nem néz tovább, de a
  listán marad): kézi, az évadjelölés és az új évad sem írja felül; a „Mind megnézve” feloldja
  (→ Megnézve, a visszavonás az Abbahagyva-t is visszaadja); a „Mégis folytatom” után az
  adatbázis az évadokból számol
- `components/TitleTable.js` – asztali soros nézet (≥ 1400 px, `DESKTOP_QUERY` a
  `Watchlist`-ben; `table-layout: fixed`, minden maradék hely a címoszlopé): balra borító (72 px
  széles – Norbi kérése, 2026-10-04: így olyan magas, mint mellette az adatok; gomb:
  rákattintva a szerkesztő ablak – részletek, hasonló címek; rámutatva türkiz keret) +
  adatok (a cím 20 px-es, mindig egy sorban, ha így sem fér ki „…” + tooltip; a műfajok külön
  sorban)
  + Franchise lenyíló saját, fix `11rem` (176 px) oszlopban, középre igazítva (Norbi
  leghosszabb franchise-neve is kifér); üresen átlátszó, de a helyét megtartja (így a sorok nem
  ugrálnak), rámutatáskor / billentyűzetes fókusznál látszik + TMDB leírás (`overview`;
  ≥ 1900 px egymás mellett: borító | cím oszlop fix `22.5rem` (360 px, Norbi címeinek kb. 96%-a
  belefér, a hosszabbak „…”-val) | franchise | leírás, a franchise két oldalán egyforma
  rácsköz, a leírás minden sorban ugyanott kezdődik, minden maradék helyet megkap, a
  „Letöltve” felirat felé 120 px (`--overview-gap-end`), 4 sorban; 1440p-re (2560 px)
  optimalizálva; 1900 px alatt a franchise a cím adatai mellett, a leírás alattuk 2 sorban;
  teljes szöveg rámutatáskor),
  jobbra sorrendben Letöltve – Állapot – Mama (kitöltve borostyán: `.mama-set`) – Értékelés
  (10 másfélszeres csillag középen, mellette „8/10”), a végén kuka: megerősítés nélkül
  lekerül, 8 mp-ig visszavonható (`onDelete`). A sor az első rámutatáskor / fókusznál kiszámolja a borító
  hangulatszínét, és rámutatva halványan felveszi. Az üres
  Állapot / Mama lenyíló és a kuka csak a sorra mutatva (vagy fókusznál) látszik teljesen
  (`@media (hover: hover)`). Fejléc: kis, ritkított nagybetűs címkék; állapotcsík: lekerekített
  pálca a borító mellett (`td:first-child::before`). Azonnali, optimista mentés (hibánál
  visszaáll). Megjegyzés mező nincs a felületen (Norbi kérésére; a `notes` oszlop megmaradt).
  Évados sorozatnál a Letöltve cellában a letöltött évadok, az Állapot cellában az évadcsík
  (`SeasonDownloads`, `SeasonCell`); a borítókártyán a borító alján évadcsík + „x/y évad”
- `components/FranchiseSelect.js` – franchise lenyíló (üres / meglévők / „+ Új franchise…”
  → helyben névmegadás, Enter: hozzáadás, Esc: mégse / „× „Név” törlése…” a kiválasztottra,
  megerősítéssel, minden címről lekerül / „✎ „Név” átnevezése…” – helyben, a régi névvel
  kitöltve, Enter: mentés, Esc: mégse; ütközésnél hibaüzenet); soros nézet és szerkesztő ablak is
- `components/StarRating.js` – `StarRating` (szerkeszthető: rádiógombok, nyilakkal is
  állítható, a kiválasztott csillagra újra kattintva `null`; választáskor a kitöltött csillagok
  egymás után „pattannak” – `.pop` + `--i`, csak kattintásra / nyílra, betöltéskor nem) és
  `StarsDisplay` (csak kijelzés)
- `components/ListSkeleton.js` – csontváz-betöltés a lista helyén, amíg tölt (asztali
  listanézetben 6 sor, egyébként 12 kártya körvonala, csillogó áthúzással; felolvasónak „Lista
  betöltése…”); a `SimilarTitles` betöltése is borító-körvonalakkal (`.similar-sk`)
- `lib/viewTransition.js` – `canMorph(elem)` (támogatott böngésző, ≥ 900 px, nincs „kevesebb
  mozgás”, az elem a lapon van) és `MORPH_NAME` (`editor-poster`); `trackTransition(t)` (a
  `Watchlist.openEditor` hívja) és `afterTransition()` – a megnyitás közben érkező, nem sürgős
  frissítések (hangulatszín: `usePosterColor` – a vászonra rajzolás is –, „Hol nézhető?”,
  előzetes, hasonló címek, előnézeti adatok) megvárják a 0,3 s-os mozgás végét: terhelt gépen
  (Norbi: videó mellett, 2026-10-05) ezek egy-egy hosszú képkockát okoztak a mozgás közepén. Új,
  a szerkesztő megnyitásakor érkező állapotfrissítésnél is ezt használd
- `lib/useMediaQuery.js` – `useMediaQuery(query)` hook (`useSyncExternalStore`)
- `lib/useBackdropClose.js` – `useBackdropClose(dialogRef, { onClose, canClose, onBlocked })` →
  `{ onPointerDown, onClick }` a `<dialog>`-ra: kikattintásra (a háttérre) bezár, telefonon
  (≤ 640 px) nem; a lenyomásnak is kívül kell lennie (a kifelé húzott kijelölés nem zár); a
  beágyazott ablak kattintása a külsőnek nem számít kívülnek. Használja (terv-3 24 és 32, Norbi
  kérése): `TitleEditor` (mentetlen módosításnál `onBlocked` → figyelmeztetés), `StatsDialog`
  (mindig), `FranchisesDialog` (átnevezés / törlés-megerősítés / új név gépelése és nyitott
  gyűjtemény-ablak alatt nem), `CollectionDialog` (rész felvétele közben és a nézési sorrend
  szerkesztése közben nem; a nyitott TMDB-gyűjtemény-keresőnél igen – Norbi kérése, 2026-10-07; a
  Franchise-ok ablakból nyitva mindkét ablak bezárul – `onOutsideClose`), `BackupsDialog` (mentés / visszaállítás közben és nyitott
  megerősítésnél nem). Az importablakok (Tömeges import, IMDb import) nem (Norbi döntése)
- `components/SiteFooter.js` – kötelező TMDB forrásmegjelölés, ne töröld; jobbra lent „sponsored by
  ADERTIS” (az ADERTIS link: https://www.adertis.hu, új lapon – Norbi kérése, 2026-10-05; külön
  `span.sponsor`, nem `p` – a teszt egy bekezdést vár a láblécben)
- `components/TitleSearch.js` – „Cím hozzáadása” panel: késleltetett (400 ms) TMDB keresés,
  találati lista, „Hozzáadás a listához” gomb; a már listán lévőknél „✓ A listán”;
  `initialQuery` (kitöltve nyílik); üres keresőnél a felfedező sorok (`Discover`); a találat
  borítója (`.thumb-btn`, egérrel) és címe (`.title-btn`) az adatlapot nyitja (`onPreview`,
  előnézet – a listán lévőé szerkeszthető), a Felfedezésben a borító (`.discover-poster`)
- `components/Discover.js` + `app/api/tmdb/discover/route.js` – Felfedezés: „Most a
  mozikban” (`cinema`), „Hamarosan a mozikban” (`upcoming`, dátummal), „Új digitálisan”
  (`digital`), „Népszerű sorozatok” (`tv`), vízszintes borítósorok, „+ Hozzáadás” / „✓ A
  listán” (a `.discover` oszlopa `minmax(0, 1fr)`: a sorok a helyükön görögnek – enélkül a
  rács a 16 borító szélességére nőtt, és telefonon az egész lap kicsinyedett, 2026-10-05). A
  borítók türkiz kerete rámutatásra csak `@media (hover: hover)` alatt (telefonon az érintés
  után ne ragadjon be), fókusznál mindig. A nem listán lévők borítóján × („Nem érdekel”, terv-3
  39, `HideButton`): az elrejtett címek nem látszanak; alul „Elrejtett ajánlások (N)” → lista,
  „Mégis érdekel”. Norbit csak a **magyar szinkronos** címek érdeklik; a TMDB ezt nem tárolja, ezért
  közelítés: film = magyarországi megjelenés (`discover/movie`, `region=HU`,
  `with_release_type` 2|3 vagy 4), sorozat = magyar előfizetéses streamingen elérhető
  (`discover/tv`, `watch_region=HU`, `flatrate`, 90 napon belül futott rész); mindkettőnél
  angol vagy magyar eredeti nyelv, van magyar leírás, és nincs dokumentum / valóságshow /
  talkshow / hírek / szappanopera műfaj. A felület ezt egy mondatban jelzi. Listánként
  legfeljebb 16, 5 oldalig, egy óráig gyorsítótárazva (`cached()`). A listák betöltője közös:
  `lib/server/discover.js` (`discoverList(name)`, `DISCOVER_LISTS`; csak route handlerben).
  **Kiemelt sáv** fölül (terv-3 46, 2026-10-07, Norbi választása: „A” látványterv –
  `munka/terv-3/terv-46/`; `components/FeaturedBand.js` + `app/api/tmdb/featured/route.js`): a
  „Most a mozikban” első 6 nem elrejtett címe egyenként, nagy jelenetképpel (jobbra, balra a sötétbe
  olvadva), logóval (magyar, ha van – különben `pickLogo`; ha nincs, a cím), év · 2 műfaj ·
  játékidő · „moziban júl. 29. óta” (türkiz), 3 soros leírás, „Adatlap” (előnézet, nézetváltás
  nélkül) / „+ Hozzáadás” (a kereső felvétele) / „✓ A listán”; ‹ / › nyíl, pöttyök, alatta a kis
  képek; telefonon fent a kép, alatta a szöveg, nyíl és kis képek nélkül, ujjal húzva lapoz. Magától
  nem lapoz (Norbi döntése). A nem listán lévőn × („Nem érdekel”) – az elrejtett helyére a következő
  jelölt lép (a route 10 jelöltet ad: a „Most a mozikban” első 10-éből a háttérképesek, egy óráig
  gyorsítótárazva). A lenti „Most a mozikban” sorból a kiemeltek kimaradnak (Norbi döntése). Betöltés
  alatt csontváz (`.featured-sk`), hibánál a sáv elmarad.
  **„Neked ajánlott”** (terv-3 37, 2026-10-07) – az ötödik, utolsó sor: a 8+ saját értékelések közül a
  legjobb 10 (azon belül a legutóbb megnézettek – `recommendSeeds(titles)`, a Watchlist adja a
  `TitleSearch`-en át) `/api/tmdb/similar` ajánlásai (ugyanaz a route és `v=2`, mint a Hasonló
  címeknél, így gyorsítótárazva), 3-asával, a gyakoriság szerint (ami több kedvenchez is ajánlott,
  elöl), legfeljebb 16; a betöltéskor listán lévők kimaradnak (a most felvett „✓ A listán”-nal marad);
  ×-szel elrejthető. A magyar megjelenést itt nem szűri (az alcím jelzi); 8+ értékelés nélkül nincs sor
- `components/FranchisesDialog.js` – „Franchise-ok” ablak a ⋮ menüből (terv-3 23-as pont,
  2026-10-05, Norbi döntéseivel): az összes franchise **ábécérendben, névelő nélkül** („A” / „Az” /
  „The” nem számít, a név kiírva változatlan), csempénként (asztalon 4, 900 px alatt 3, telefonon 2
  oszlop): logó sötét alapon (`FranchiseLogo`; ha nincs, a név), név, mérő; a csempe hangulatszínt
  kap a franchise legjobb IMDb-értékelésű, borítós címének borítójából (terv-3 47, 2026-10-06,
  látványterv nélkül – `FranchiseTile` + `usePosterColor`, `.fr-tile[data-ambient]`: halvány keret,
  derengő csempetető, színezett logóháttér), „x/y megnézve · m hiányzik” (y = a listán lévők
  száma, mint a mérőben – Norbi kérése, 2026-10-06) – a hiányzók a TMDB-gyűjteményekből (a `FranchiseCollection` közös
  függvényeivel; 3-asával töltve, franchise-onként a lekérés kulcsával – `paramsKey` –
  megjegyezve, ha a címek / kézi gyűjtemények változnak, újra; betöltés alatt „· …”, `aria-busy`),
  „· nincs TMDB-gyűjtemény”, üresen „Még nincs címe”. A csempére kattintva a gyűjtemény-ablak
  (`CollectionDialog`, a Franchise-ok ablakon belül nyílik); a csempe alatt „Szűrés erre” (üres
  franchise-nál tiltva; `Watchlist.showFranchise`: a keresés törlődik, minden más szűrő elenged –
  `SEARCH_FILTERS` + a franchise –, az ablak bezárul), „Átnevezés” (helyben, Enter / Esc – az Esc
  a mezőben csak a szerkesztést zárja), „Törlés” (megerősítéssel; a címek maradnak). Felül kereső
  (ékezet nélkül is), alul „+ Új franchise” (létrehozás után a gyűjtemény-ablaka nyílik). A
  külső ablak `onClose`-a csak a saját eseményére zár (`e.target === e.currentTarget`): a
  belső `<dialog>` „close” eseményét a React a külső kezelőnek is továbbítja.
  Fölül (keresés közben nem) **„Javasolt hozzárendelések”** (`components/FranchiseSuggestions.js`,
  terv-3 35): a franchise nélküli filmek, amelyek egy franchise-od TMDB-gyűjteményébe tartoznak;
  pipálható (alapból mind) → „Hozzárendelés (N)” (`assignFranchises()`, franchise-onként egy
  módosítás); soronként „Nem kell” (`franchise_suggestion_off`: többé nem javasolja). Ha nincs
  javaslat, nem látszik
- `lib/franchiseSuggest.js` – franchise-javaslat (terv-3 35, 2026-10-07; Norbi döntése: **csak
  felajánlja**, magától soha nem rendel hozzá, a meglévő franchise-t nem írja át):
  `collectionFranchiseMap()` (TMDB-gyűjtemény → franchise: a franchise filmjeinek `tmdb_collection_id`-ja
  és a kézzel hozzárendelt gyűjtemények; több franchise-nál a kézi nyer, aztán a több filmes, aztán
  a név), `suggestedFranchiseId(t, map)`, `franchiseSuggestions()`, `article()` („a” / „az”). A
  `Watchlist.handleAdded` (minden felvétel ezen át megy) a felvétel után 1,2 mp-cel felajánlja: egy
  filmnél sáv „„…” – a Dűne franchise-ba tartozik?” + „Hozzárendelés”, többnél (pl. tömeges import)
  „N új film egy franchise-odba tartozik” + „Megnézés” (a Franchise-ok ablak). Nyitott `<dialog>`
  alatt (adatlap, import) a sáv nem kattintható, ezért a bezárásáig vár (`close` esemény, elkapva);
  közben kézzel beállított franchise-nál már nem kérdez
- `app/api/tmdb/title-collections/route.js` – `POST`: a filmek TMDB-gyűjteménye
  (`tmdb_collection_id`, `collection_checked_at`) 40-esével, a felhasználó jogaival; esedékes:
  `collectionDue()` (még nem néztük; vagy gyűjtemény nélküli, tavalyi / idei / jövőbeli film,
  30 naponta). A `Watchlist` betöltéskor hívja (`refreshTitleCollections()`, legfeljebb 40 kör).
  Az új filmek felvételkor kapják meg (a details route adja)
- `components/FranchiseCollection.js` + `app/api/tmdb/collection/route.js` +
  `app/api/tmdb/collection-search/route.js` – franchise-ra szűrve mindig sáv a lista fölött
  (háttérképpel – terv-3 45, 2026-10-06: a franchise legjobb IMDb-értékelésű, háttérképes címének
  jelenetképe, ha nincs, a TMDB-gyűjteményé – `franchiseBackdrop()`, a gyűjtemény-ablak fejléce is ezt
  mutatja; a kép a sáv jobb felén – asztalon legfeljebb ~670 px –, elmosás nélkül, balra a sötétbe
  olvadva, mert teljes szélességben túl nagyított lett volna; telefonon teljes szélességben,
  halványan; nagyobb logó – `data-backdrop`, `--banner-img`)
  (logó vagy név, mérő: a listán lévők közül a megnézettek aránya zölden, a többi szürke – a hiányzó
  részek nem számítanak, türkiz nincs; Norbi döntése, 2026-10-06 –, „x/y megnézve · m hiányzik” –
  y a listán lévők száma, a mérővel egyezően –, gyűjtemény nélkül „· nincs hozzá TMDB-gyűjtemény”; „Gyűjtemény” gomb). Ablak,
  gyűjteményenként egy szakasz: a franchise **összes** filmjének (legfeljebb 60) minden
  `belongs_to_collection`-je, plusz a kézzel hozzárendeltek (`franchises.tmdb_collection_ids`,
  „kézzel hozzárendelve · Eltávolítás”), a legkorábbi részük szerint sorban; a részek
  megjelenési sorrendben (sorszám a borítón; megnézett / abbahagyott szürke + saját értékelés
  borostyán, listán lévő „A listán”, hiányzó szaggatott kerettel „+ Hozzáadás” → `addTitle` +
  a franchise beállítása; „A hiányzó N felvétele” kettesével). „A franchise-od további címei”
  (gyűjtemény nélkül: „A franchise-od címei”): a gyűjteményekben nem szereplő saját címek
  (sorozatok – a TMDB-gyűjteményekben sosem szerepelnek –, gyűjtemény nélküli filmek), sorszám
  nélkül, megjelenés szerint. „+ TMDB-gyűjtemény hozzáadása”: késleltetett keresés
  (`search/collection`; magyarul gyakran nincs találat, angolul igen – pl. „Star Wars”) →
  „Hozzárendelés” (`setFranchiseCollections`). A számlálás a gyűjtemények részeinek
  uniója + a további címek. Gyorsítótár: filmenként a gyűjtemény-azonosító és gyűjteményenként
  a részek egy napig. (Az első változat franchise-onként csak egy gyűjteményt mutatott, és
  Norbi 40 franchise-ából 15-nél kihagyott címeket – 2026-10-04.) Közös exportok (a Franchise-ok
  ablak is használja): `collectionParams()`, `paramsKey()`, `fetchCollections()`,
  `summarizeCollection()` (szakaszok, további címek, számok + `missing`), `CollectionMeter` (egy zöld
  szakasz: megnézve / listán; `flex: none`. 2026-10-06-ig a második, „listán” szakasz a közös
  `.on-list` címke stílusát örökölte – a margója miatt nem látszott, és teli mérő sem telt meg),
  `CollectionDialog`. A gyűjtemény-ablak két fülön (terv-3 28, Norbi döntése; `role="tablist"`,
  nyilakkal is; a panelek rejtve megmaradnak): „Gyűjtemény” (a fenti) és „Nézési sorrend”
  (`WatchOrder`); sorrend-szerkesztés közben kikattintásra nem zár, az Esc csak a szerkesztést zárja
- `components/WatchOrder.js` + `lib/watchOrder.js` – nézési sorrend (terv-3 28, 2026-10-06, Norbi
  döntéseivel): a franchise **listán lévő** filmjei és a sorozatok **évadjai külön tételként**
  (`franchiseItems()`; évad nélküli sorozat egy tétel; tételkulcs `címId:évad`, 0 = film),
  számozott listában: jelölőnégyzet, sorszám, kis borító, „Loki – 2. évad”, év / „Bejelentve”.
  `orderedItems()`: a tárolt sorrend (`franchise_order`), a benne nem szereplők (új cím / évad)
  **a végére**, egymás közt megjelenés szerint (film: mozis / digitális dátum, különben az év;
  évad: `air_date`); amíg nincs tárolt sorrend, megjelenés szerint. A megnézett tétel **kihúzva a
  helyén marad** (`data-done`), az első meg nem nézett, megjelent, nem abbahagyott „Következik”
  (`nextItem()`); abbahagyott sorozat meg nem nézett évadja „Abbahagyva”, kihagyva; bejelentett
  évad nem jelölhető. A pipa filmnél `updateTitle(status)` (vissza: Megnézendő), évadnál
  `setSeasonStatus` (az előtte lévő üres évadokat is kitölti, „Visszavonás” a sávban – mint a
  listán: az egész kattintást visszacsinálja); ha a cím megnézett lett és nincs értékelése, a tétel
  alatt „Hogy tetszett?” (Norbi döntése; az ablak fölött a toast nem kattintható, ezért helyben, a
  Watchlist `handleRowUpdated(row, false)`-szal nem kérdez újra). „Sorrend szerkesztése”: húzás a
  fogantyúnál (pointer-események az ablakon – az átrendezéskor a fogantyú a DOM-ban máshová kerül;
  `touch-action: none`; az ablak szélén görget) és ↑ / ↓ (a fókusz a gombon marad, felolvasónak
  „…: 3. hely”); „Kész” egyben ment (`saveOrder` → `set_franchise_order` RPC), „Megjelenés
  szerint” + „Kész” törli a saját sorrendet (`clearOrder` – a rendezés is eltűnik), „Mégse” / Esc
  elveti. `loadOrders()` a Watchlist betöltésekor (hibánál a lista attól még működik),
  `franchisesWithOrder()` – melyik franchise-nak van ma is érvényes sorrendje
- `components/TopCast.js` + `app/api/tmdb/credits/route.js` – szereplők az adatlapon (terv-3 38,
  2026-10-06, Norbi választása: „A” látványterv – `munka/terv-3/terv-38/`): a top cast első 3 tagja
  (`pickCast()`: filmnél a credits, sorozatnál az aggregate_credits sorrendje; rendező nincs; egy
  napig gyorsítótárazva; a TitleEditor egyszer kéri le, `afterTransition` után). Asztalon (≥ 900 px)
  a bal oszlopban a „Hol nézhető?” alatt (`.cast.side`: kerek fotó, név, szerep), keskenyebben a
  leírás alatt egy sor („Szereplők: …”, `.cast-line`). A név a színész TMDB-oldalára visz, új lapon
- `app/api/tmdb/videos/route.js` – `GET ?type&id` → `{ video: { key, name, lang } | null }`:
  YouTube, „Trailer” előbb, hivatalos előbb, legfrissebb; magyar nyelvű, ha nincs, angol (ha a
  cím már nincs a TMDB-n: `null`; a similar route is üres listát ad ilyenkor)
- `components/WatchProviders.js` + `app/api/tmdb/providers/route.js` – „Hol nézhető?” az
  adatlapon (terv-3 21-es pont, 2026-10-04): `GET ?type&id` → `{ providers: [{ id, name, logo,
  free }] }` (`pickProviders()`: a TMDB `watch/providers` magyarországi `flatrate` +
  `free` + `ads` szolgáltatói, a TMDB sorrendjében; egy napig gyorsítótárazva; ha a cím nincs
  a TMDB-n: üres). Norbi döntései: csak az adatlapon; asztalon (≥ 900 px) a nagy borító alatt
  (`.editor-side` burkoló: a borító + `.watch-providers.side`; a ragadás és a háttérképre
  csúszás a burkolón), keskenyebben a fejlécben az „Előzetes megnézése” fölött
  (`.watch-providers.inline`); kölcsönzés / vásárlás nincs; ha nincs szolgáltató, semmi nem
  látszik; a logók (w92) nem kattinthatók, a név a súgóban / alt-ban („… (ingyenes)”). Alattuk
  kötelező „Forrás: JustWatch” (TMDB-feltétel). A logók 56 px-esek (3,5 rem, Norbi kérése)
- `lib/supabase.js` – Supabase kliens
- `lib/api.js` – `apiGet()`: saját `/api` route hívása `Authorization: Bearer` tokennel,
  hibánál a szerver magyar üzenetével dob
- `lib/titles.js` – címműveletek: `titleKey()`, `addTitle()` (műfajok upsert → `titles`
  insert → `title_genres` insert, hibánál a cím visszavonása), `updateTitle()`,
  `deleteTitle()`, `createFranchise()`, `renameFranchise()`, `deleteFranchise()`; a címműveletek a `titles_with_genres` friss sorát adják
  vissza (törlés kivételével). A franchise nevét a kliens keresi ki id alapján (nincs a nézetben).
  Sorozatnál az `addTitle()` az évadokat is felveszi (`title_seasons`, `seasons_checked_at` = most;
  a már megjelentek `aired_notified = true`, róluk nincs értesítés; a kézi `addSeason()` is).
  Évadok: `setSeasonStatus()` (visszaad `{ row, filled, previous }`), `markAllSeasonsWatched()`,
  `restoreSeasons()` (visszavonás), `setSeasonDownloaded()`, `addSeason()` (kézi, mai dátummal),
  `removeLastSeason()`,
  `refreshSeasons()` (háttér), `seasonAired()`, `NEXT_SEASON_STATUS`.
  Az `addTitle(item, details)` második paramétere a már lekérdezett `/api/tmdb/details` válasz
  (az előnézeti adatlapé), ha van.
  Megjelenés: `refreshReleases()` (háttér), `releaseState(t)` – `{ kind: 'soon', date | year }`
  (a moziba sem került még, vagy csak digitálisan jön; dátum nélkül jövőbeli / hiányzó év),
  `{ kind: 'cinema', digital }` (moziban, digitálisan még nem; a mozis bemutató után 120 napig,
  ha nincs digitális dátum), `null` (megjelent / sorozat / megnézett); `formatReleaseDate()`
  („okt. 15.”, más évben „2027. márc. 3.”), `releaseLabel(state)` → `{ word, when, sub }`
  („Hamarosan” / „Moziban”, a dátum, „digitálisan: …”).
  Közös segédek: `externalLink()`, `formatDate()`, `todayDate()`, `DEFAULT_STATUS`,
  `DROPPED_STATUS` („Abbahagyva”, csak sorozatnál), `MAMA_OPTIONS`, `mamaLabel()`
- `lib/server/auth.js` – `getUserFromRequest()`, `supabaseAsUser()` (a felhasználó nevében,
  RLS-sel), `unauthorized()` (csak route handlerben). A `getUserFromRequest()` a tokent helyben
  ellenőrzi (`auth.getClaims()`: a projekt ES256-tal ír alá, a nyilvános kulcs – JWKS – a
  szerverpéldányban gyorsítótárazva; ~1 ms a korábbi ~60 ms-os Auth-kérés helyett; terv-3 34, E3,
  Norbi döntése, 2026-10-06). Ára: egy máshol kijelentkeztetett munkamenet tokenje a lejáratáig
  (≤ 1 óra) még elfogadott – az adatokat az RLS védi. `{ id, email }`-t ad (a route-ok csak azt
  nézik, van-e)
- `lib/refreshDue.js` – a háttérfrissítések „esedékes-e” szabályai (terv-3 34, E2, 2026-10-06):
  `imdbDue` (van IMDb ID, 14 napnál régebbi / hiányzó), `backdropDue` (még nem néztük),
  `seasonsDue` (sorozat, 7 nap), `releaseDue` (a megjelenési dátumoké), `collectionDue` (a filmek
  TMDB-gyűjteménye – terv-3 35), `budapestToday()`. A
  `lib/titles.js` `refresh…(titles, onUpdated)` függvényei csak akkor hívják a route-ot, ha a
  betöltött listában van esedékes; a route-ok ugyanezt kérdezik (az IMDb / évad / háttérkép SQL-ben
  – a napok innen –, a megjelenés ezzel a függvénnyel). Ha a szabályon változtatsz, mindkét helyen
- `lib/fetchAll.js` – `fetchAll(build)`: a Supabase (PostgREST) egy kérésre legfeljebb **1000
  sort** ad (mérve, 2026-10-06; Norbi listája ekkor 897 cím): ami ennél több is lehet, ezres
  adagokban (`.range`), egyértelmű rendezéssel. Használja: a lista betöltése, a nézési sorrendek,
  az elrejtett ajánlások, a `releases` route. **Új, a teljes listát lekérő lekérdezésnél ezt
  használd**
- `lib/server/tmdb.js` – `cachedResponse(body, másodperc)` (`Cache-Control: private, max-age` –
  a böngésző tárolja a nyilvános TMDB-adatot adó GET-válaszokat; terv-3 34, 2026-10-05: providers,
  videos, similar, collection, find 1 nap – `DAY_S`; discover, details 1 óra – `HOUR_S`; search 10
  perc; hibaválasz soha), `tmdbFetch()`, `tmdbErrorResponse()`, `yearOf()`, `pickReleaseDates()`
  (mozi: 3, ha nincs 2; digitális: 4; előbb HU, ha nincs US; országon belül a legkorábbi), `cached(kulcs, ms,
  betöltő)` (memóriában, a szerverpéldány élete alatt, legfeljebb 500 elem; a hibát nem tárolja;
  a videos és a similar 1 napig, a details TMDB-része és az OMDb-érték – `omdb:` kulcs – 1 óráig), `pickSeasons()`
  (a TMDB évadjai a „0. évad” – különkiadások – nélkül) (csak route handlerben)
- `app/api/tmdb/search/route.js` – `GET ?q=` → `search/multi`, csak film/sorozat
- `app/api/tmdb/details/route.js` – `GET ?type=movie|tv&id=` → a `titles` oszlopainak
  megfelelő objektum + `genres [{id, name}]`, sorozatnál `seasons` is; magyar leírás híján
  angol; az IMDb-értékelést is lekéri (OMDb), ha nem sikerül, a cím attól még felvehető;
  filmnél a TMDB-gyűjtemény is (`tmdb_collection_id`, `collection_checked_at` – terv-3 35)
- `app/api/tmdb/seasons/route.js` – `POST`: a még nem vagy 7 napnál régebben ellenőrzött
  sorozatok évadait frissíti a TMDB-ről (új – megjelent vagy bejelentett – évad, név,
  epizódszám, dátum; az állapothoz / letöltve jelzőhöz nem nyúl), 10-esével; a frissített
  sorokat adja vissza. A `Watchlist` betöltéskor hívja. Értesítés: ha egy már ismert évadlistájú
  (nem abbahagyott) sorozathoz új, még meg nem jelent évad érkezik → `season_announced`; az új,
  már megjelent évadot `aired_notified = false`-szal veszi fel (arról a gyűjtés szól); az első
  feltöltésnél a megjelentekről nem szól
- `app/api/tmdb/similar/route.js` – `GET ?type=movie|tv&id=` → a TMDB ajánlásai (ha kevés, a
  hasonlókkal pótolva, forrásonként 2 oldalig), csak borítóval, legfeljebb 12, a kereséssel azonos
  mezőnevekkel. Szűrés (Norbi kérése, 2026-10-07): csak 2000-es vagy újabb (sorozatnál az első évad
  éve), legalább 6,0-s **TMDB**-értékelésű, legalább 50 szavazatos címek – filmnél és sorozatnál is
  (az IMDb-érték címenként egy OMDb-kérés lenne, a napi 1000-es keretből; Norbi az A változatot
  választotta). A kliens `v=2` paraméterrel kéri (a böngésző egynapos gyorsítótára miatt; a szűrés
  következő változásakor emeld)
- `app/api/tmdb/backdrops/route.js` – `POST`: a még meg nem nézett címek (`backdrop_checked_at`
  üres) háttérképét lekéri a TMDB-ről és elmenti (40-esével, a felhasználó jogaival; ha nincs
  háttérkép vagy a cím már nincs a TMDB-n, csak megjelöli). A `Watchlist` betöltéskor hívja
  (`refreshBackdrops()`, legfeljebb 30 kör). Az új címek felvételkor kapják meg (a details
  route adja a `backdrop_path`-t és a `backdrop_checked_at`-et)
- `app/api/tmdb/releases/route.js` – `POST`: a filmek megjelenési dátumai (`pickReleaseDates`)
  40-esével, a felhasználó jogaival; esedékes: meg nem nézett, tavalyi / idei / jövőbeli (vagy
  év nélküli) film, 3 napja nem néztük, és a digitális dátuma nem régebbi 30 napnál. A
  `Watchlist` betöltéskor hívja (`refreshReleases()`, utána újra az értesítések). Az új filmek
  felvételkor kapják meg (a details route `append_to_response=release_dates`)
- `components/MoreMenu.js` – a fejléc „További műveletek” (⋮) menüje: kerek gomb (a harang
  mintájára, `aria-haspopup="menu"`), alatta jobbra igazított lista (`role="menu"`); minden pont
  ikonnal, címmel és rövid leírással (a korábbi súgók helyett; `aria-labelledby` /
  `aria-describedby`). Kattintással vagy Enter / Szóköz / nyilakkal nyílik, a menüben nyilak,
  Home / End, Esc (a fókusz vissza a gombra), Tab és kívülre kattintás bezárja. Választáskor a
  fókusz a gombra kerül (a megnyíló ablak bezárásakor oda tér vissza). A pontok:
  `{ id, label, description, icon, onSelect }` (ikonok: star, chart, list, download, history, stack,
  book)
- `components/StatsDialog.js` + `lib/stats.js` – „Statisztika” ablak (a ⋮ menüből): csempék
  a betöltött listából (`listStats()`, adatbázis-lekérdezés nélkül) – megnézve az utolsó 12
  hónapban, havonta megnézett címek (saját SVG-oszlopdiagram, `watched_at`), műfajok (a
  műfajszínekkel), saját és IMDb-átlag, letöltve de még nem látott (az abbahagyottak nélkül),
  legtöbb cím franchise-onként, folyamatban lévő sorozatok évadhaladása; telefonon egy oszlop.
  **Ízlésprofil** (terv-3 42, 2026-10-07; `tasteProfile()` a `listStats`-ban): két csempe az
  „Értékelések” után – „Kedvenc műfajaid” (a saját csillagok átlaga műfajonként, a legjobb 5,
  borostyán sáv, „8,8 · 6” = átlag · értékelt címek) és „Te és az IMDb műfajonként” (saját − IMDb
  átlaga ugyanazokon a címeken: „Jobban tetszik neked” legfeljebb 3, borostyán; „Szigorúbb vagy”
  legfeljebb 3, szürke; a ±0,1 alatti eltérés kimarad; „+2,0” / „−3,0” – `formatSigned`); egy
  műfaj legalább 3 értékelt címtől számít (`TASTE_MIN`), különben magyarázó szöveg
- `components/SimilarTitles.js` – „Hasonló címek” a szerkesztő ablak alján: lenyitó gomb (alapból
  nyitva; ha becsukja, a böngésző megjegyzi: `localStorage`, `filmlista-hasonlok`; nyitva tölt be;
  telefonon – ≤ 640 px – mindig csukva indul, Norbi kérése, és ott a nyitás / csukás nem
  jegyződik meg),
  vízszintesen görgethető borítósor (évszám, típus; a borító gomb az ablakon belül a cím adatlapját
  nyitja – `onPreview`, előnézet vagy a listán lévőé –, a cím link a TMDB-oldalra), „+ Hozzáadás”
  (`addTitle()`), a listán lévőknél „✓ A listán”; a többi borítón × („Nem érdekel”, terv-3 39)
- `lib/hiddenSuggestions.js` + `components/HideSuggestion.js` – „Nem érdekel” (terv-3 39,
  2026-10-06): elrejtett ajánlások (`hidden_suggestions`), közös tároló a `lib/toast.js` mintájára
  (`useHiddenSuggestions()` – titleKey → sor; `loadHidden()` a Watchlist betöltésekor és
  visszaállítás után, `resetHidden()` kilépéskor; `hideSuggestion()` / `unhideSuggestion()`
  optimista, hibánál visszaáll). A Felfedezés és a Hasonló címek szűri (a keresés nem). `HideButton`
  (× a borító jobb felső sarkában; egérrel csak rámutatáskor / fókusznál látszik), `HideNote` +
  `useHideSuggestion()`: „„…” elrejtve – többé nem ajánljuk. Visszavonás” helyben, a szakasz tetején,
  10 mp-ig (a szerkesztő ablakban az értesítősáv nem kattintható)
- `lib/useStrike.js` – kihúzás (terv-3 40): `useStrike(status)` → hányszor vált megnézettre, amióta
  látszik; a cím köré tett `.strike` span kulcsa és `data-strike` jelzője (PosterCard, TitleTable
  sora – nézési sorrendben a tétel állapota): váltáskor a span újraépül, a CSS-animáció lefut,
  betöltéskor nem. A nézési sorrendben (`WatchOrder`) a kipipált tétel `data-strike`-ot kap, a vonal
  ott megmarad
- `app/api/imdb/refresh/route.js` – `POST`: a hiányzó vagy 14 napnál régebbi IMDb-értékeléseket
  frissíti (25-ösével, a felhasználó jogosultságaival); a `Watchlist` betöltéskor hívja
- `lib/server/omdb.js` – `fetchImdbRating()`, `omdbEnabled()` (csak route handlerben)
- `app/api/keepalive/route.js` + `vercel.json` (crons, naponta 04:17 UTC) – ébren tartás: egy
  apró lekérdezés, hogy a Supabase ingyenes projektje ne szüneteljen tétlenség miatt. Ha a
  Vercelen van `CRON_SECRET`, csak azzal hívható (a Vercel Cron automatikusan küldi)
- `components/ImdbBadge.js` – „IMDb 8,0” jelvény (rámutatva a szavazatok száma)
- `components/FranchiseFilter.js` – a franchise-szűrő saját lenyílója (listbox: nyilak, Home/End,
  Enter, Esc) logókkal; `FranchiseLogo` betöltéskor megméri a logó világosságát (canvas, a TMDB
  képszervere CORS-t enged), 0,5 alatt fehérre színezi (`.franchise-logo.dark`)
- `app/api/franchises/logos/route.js` – `POST`: a logó nélküli franchise-oknál a franchise első
  (legkorábbi) filmjének TMDB-címlogóját menti (`pickLogo()`: legfeljebb 6:1 arány, angol);
  ha nincs logó, 7 napig nem próbálja újra. A `Watchlist` hívja (`logoDue` effekt, 1,5 mp
  várakozással): betöltéskor, és rögtön, amikor egy logó nélküli franchise-hoz az első cím bekerül
  (gyűjtemény, adatlap, sor, tömeges import) – franchise-onként munkamenetenként egyszer
  (`logoTried`); üres franchise-nál nincs mit keresni (Norbi kérése, 2026-10-05: a Rocky logója csak
  a következő betöltéskor jött le)
- `components/ImdbRatingsImport.js` + `lib/imdbImport.js` – „IMDb import” a ⋮ menüből
  (`ref.current.open()` → rejtett fájlválasztó; a komponens csak a fájlmezőt és az ablakot
  rajzolja). `parseImdbExport()` felismeri a két IMDb-exportot:
  - **értékelések** (CSV: `Const`, `Your Rating`): a böngészőben IMDb ID alapján párosít,
    összefoglalót mutat, majd `applyMyRatings()` (csillagértékenként egy update). Norbi
    döntései: csak a listán lévő címek, az IMDb csillaga felülírja a sajátot, az állapot nem
    változik, új cím nem kerül fel;
  - **figyelőlista / watchlist** (a `Position` oszlopról ismeri fel; epizód, játék, podcast,
    klip kimarad; ismétlődés egyszer): `planWatchlistImport()` – a listán (IMDb ID-vel) lévők
    kimaradnak, a többit 3-asával a `/api/tmdb/find`-dal keresi (a TMDB-azonosító szerint már
    listán lévők is kimaradnak), kipipálható lista (borító, magyar cím, év, típus, eredeti cím;
    alapból mind kipipálva), a TMDB-n nem találtak felsorolva → „N cím felvétele” (`addTitle()`
    2-esével, Megnézendő; a sikertelenek hibaüzenettel). Terv-3 20-as pont, 2026-10-04.
  Teljesen automatikus szinkron nincs (az IMDb-nek nincs API-ja, az oldal gépi olvasása tiltott).
  A párhuzamos feldolgozás (`mapLimit`) a `lib/bulkImport.js`-ben (a tömeges import is ezt használja).
- `app/api/tmdb/find/route.js` – `GET ?imdb=tt…` → `{ result: { media_type, tmdb_id, title,
  original_title, release_year, poster_path } | null }` (TMDB `find`, magyar cím; egy napig
  gyorsítótárazva)
- `components/NotificationBell.js` + `lib/notifications.js` – harang a fejlécben: a nem olvasott
  értesítések száma borostyán jelvényben (`--accent-2`); kinyitva a legutóbbi 30 (új évad bejelentése / megjelenése,
  film digitális megjelenése – „Digitálisan is megjelent – már letölthető”, Mama jelölése – „Mamát
  érdekli”, terv-3 13; borítóval); kinyitáskor mind olvasott (az adatbázisban is, `markNotificationsRead()`; a
  közben beérkező régi lekérdezés sem írja vissza – `readIds` a Watchlistben); elemre
  kattintva a sorozat szerkesztő ablaka; kívülre kattintás / Esc bezár. A lista a harang bal széléhez igazodik, ha ott
  kilógna, a jobbhoz (`lib/popupSide.js`, nyitáskor mérve – a ⋮ menü is így); telefonon teljes
  szélességű. A fejléc felugró listái (`z-index: 35`) a letapadó szűrősor (30) fölött vannak. `loadNotifications()`: előbb
  `collect_season_notifications()` és `collect_release_notifications()` (RPC, párhuzamosan),
  aztán a lista; a Watchlist betöltéskor, valamint az évadfrissítés és a megjelenésidátum-frissítés
  után hívja – utóbbiakat csak, ha frissült sor (a `refreshSeasons` / `refreshReleases` a
  frissített sorok számát adja; hibánál is újratölt; terv-3 34, E1). A telepített app ikonján `navigator.setAppBadge()` mutatja a számot.
  Ha nő az olvasatlanok száma (betöltéskor is, ha van), a harang egyszer megrezzen (`.ringing`).
  **Törlés** (Norbi kérése, 2026-10-07): soronként × (`.notif-del`; egérrel csak a sorra mutatva /
  fókusznál látszik, érintőn mindig; utána a fókusz a következő × -re), a fejlécben „Összes törlése”
  (`.notif-clear`, a látható – legfeljebb 30 – értesítés); `Watchlist.removeNotifications()`: azonnal
  eltűnik, az értesítősávban „Visszavonás” (`dismissNotifications` / `restoreNotifications`; a
  közben beérkező lekérdezés sem hozza vissza – `dismissedIds`). A sor nem törlődik, csak
  `dismissed_at` kap (különben a gyűjtés újraírná)
- `components/BulkImport.js` + `lib/bulkImport.js` – „Tömeges import” (csak asztali nézetben,
  a ⋮ menüből: `ref.current.open()`): soronként egy cím (legfeljebb `MAX_LINES` = 150; a sor
  végi évszám 1900–idén+5 szűr, pl. „Dűne 2021”; az ismétlődő sorok egyszer), TMDB-keresés
  3-asával; `matchEntry()`: biztos = egyetlen pontos (ékezet / írásjel nélküli) cím- vagy
  eredeticím-egyezés (évszámmal az évnek is egyeznie kell) – előre kijelölve; bizonytalan →
  borítós választók, alapból kihagyás; a listán lévő kimarad (jelöltként nem választható);
  felvétel `addTitle()`-lal 2-esével, a sikertelenek a szövegmezőben maradnak
- `lib/exportList.js` – „Mentés letöltése”: a teljes lista CSV-ben (UTF-8 BOM, pontosvessző,
  tizedesvessző – Excelben dupla kattintással jól nyílik): típus, cím, év, állapot, letöltve,
  dátum, értékelések, Mama, franchise, műfajok, évadok, hozzáadva, IMDb / TMDB ID, megjegyzés
- `components/BackupsDialog.js` + `lib/backups.js` – „Mentések” ablak (a ⋮ menüből): a mentések
  listája (legújabb elöl: dátum, fajta – Heti / Kézi / Visszaállítás előtt / Feltöltött –, címek
  száma; a tartalmuk nem töltődik le), „Mentés most” (`create_my_backup`), soronként
  „Visszaállítás” → a sor helyén megerősítés (pirosas, Mégse / Visszaállítás) →
  `restore_my_backup`, utána `Watchlist.reloadAfterRestore()` (lista, franchise-ok,
  értesítések újra). A felirat a lista frissülése után jelenik meg (egyszerre változnak)
- `.github/workflows/mentes.yml` – „Heti mentés” (GitHub Actions, hétfő 04:30 UTC, kézzel is
  indítható): a `BACKUP_DB_URL` titokkal (`backup_reader`, psql) felhasználónként kiolvassa a
  legfrissebb mentést egy JSON-ba, és 56 napra artifactként tárolja (utána a GitHub törli); ha
  nincs 8 napon belüli mentés, a futás hibával áll le (a GitHub e-mailt küld). Visszatöltés:
  `munka/e2e/mentes-feltoltes.mjs <fájl.json> <e-mail>` → „Feltöltött” mentés → a felületen
  visszaállítható. A titkot Norbi beállította, az első (kézi) futás 2026-10-04-én sikeres, az
  artifact letölthető. A `backup_reader` jelszavának cseréje: `mentes-olvaso.mjs`, utána a
  GitHub-titkot is át kell írni. Az artifact a futás Summary oldalának alján van (a telefonos
  GitHub-alkalmazás nem mutatja)
- `components/ManualDialog.js` + `scripts/leiras.mjs` – **felhasználói leírás az appon belül**
  (terv-3 48, 2026-10-08; Norbi döntése: belső ablak, nem új lap / külön oldal): a ⋮ menü
  „Felhasználói leírás” pontja `dialog.editor.manual-dialog`-ot nyit (fent „Felhasználói leírás”,
  „Tartalom” – a tartalomjegyzékhez görget –, „Bezárás”; alatta a görgethető leírás, `.manual`,
  olvasható szélességben; telefonon teljes képernyő; kikattintásra mindig zár – nincs benne bevitel).
  A HTML-t a `scripts/leiras.mjs` állítja elő a `FELHASZNALOI-LEIRAS.md`-ből (`marked`, csak
  fejlesztői függőség) **a `npm run dev` / `npm run build` elején** (a Vercel is így buildel):
  `public/leiras/leiras.html` + a `docs/kepek/` képei a `public/leiras/kepek/`-be (a mappa git-ből
  kizárva). A főcím és a VS Code-os tipp kimarad; a fejlécek azonosítója a GitHub szabálya szerint,
  `leiras-` előtaggal (a `#…` hivatkozások is); a képek lusta betöltéssel, méretezve (`width` /
  `height` a JPEG-ből – a hivatkozásra ugráskor ne csússzon a lap); külső link új lapon. A cél
  nélküli belső hivatkozásra / hiányzó képre a szkript figyelmeztet. A belső hivatkozásokat a
  `ManualDialog` kezeli (az ablakon belül görget, a fókusz a szakaszcímre, az URL nem változik).
  Net nélkül a service worker tárolójából jön, ha már egyszer megnyílt, különben hibaüzenet +
  „Újrapróbálás”. Teszt: `munka/e2e/test-48.mjs`
- `supabase/*.sql` – a már lefuttatott adatbázis-szkriptek (dokumentáció)
- `FELHASZNALOI-LEIRAS.md` – felhasználói leírás Norbinak: minden funkció témák szerint
  (1–17. szakasz), a végén Változásnapló. Kezelési leírás, nem kód: gombnevek, lépések, szabályok.
  Képes (terv-3 33, 2026-10-06): a képek a `docs/kepek/*.jpg` (28 db, a repóban, ~2,4 MB; legutóbb frissítve 2026-10-08; asztal
  1440 × 900, telefon 390 × 844), a zsúfoltabbakon borostyán számozott jelölők (①②③), a szöveg
  ugyanazokkal a számokkal magyaráz; a telefonos képek HTML-`<img width>`-del egymás mellett. Mind
  egy szkriptből: `munka/terv-3/33-leiras/leiras-seed.mjs` (próbalista a tesztfiókba) +
  `leiras-kepek.mjs` (a képek; argumentummal csak a nevükben azt tartalmazók, pl. `05-adatlap`)

## Adatbázis (már létezik, lásd `supabase/`)
- `genres (id integer PK = TMDB műfaj ID, name)` – bejelentkezve olvasható/írható
- `statuses (code PK, name, sort_order)` – kódok: `to_watch`, `watching`, `watched`,
  `dropped` (Abbahagyva – `09_dropped.sql`; a felület csak sorozatnál kínálja)
- `titles` – `user_id` (default `auth.uid()`), `media_type` ('movie' | 'tv'), `title`,
  `original_title`, `release_year`, `overview`, `poster_path`, `tmdb_id`, `imdb_id`,
  `status` (FK → statuses), `is_downloaded`, `mama_status` (null | 'interested' | 'declined' |
  'received', „Mama” jelző: üres / Érdekli / Nem érdekli / Megkapta – `03_mama.sql`, a 'declined'
  `17_mama_access.sql`; a „Nem érdekli”-t Mama jelöli a saját oldalán, Norbinál tompa szürke: táblázat –
  `select.mama-set:has(option[value=declined]:checked)` –, adatlap – `.mama-chips
  input[value=declined]` –, nem borostyán), `franchise_id` (FK → franchises,
  null = nincs; `on delete set null`), `imdb_rating` (numeric 0–10), `imdb_votes`,
  `imdb_rating_updated_at` (`05_imdb_rating.sql`), `my_rating` (1–10), `notes`, `watched_at`,
  `seasons_checked_at` (mikor nézte az app a TMDB-n a sorozat évadait – `08_title_seasons.sql`),
  `backdrop_path` (a TMDB széles jelenetképe a szerkesztő ablakhoz), `backdrop_checked_at` (mikor
  néztük meg – `11_backdrop.sql`), filmnél `theatrical_release` (mozis bemutató),
  `digital_release` (digitális, letölthető megjelenés), `release_checked_at` (mikor néztük a
  TMDB-n) – `14_release_dates.sql`, NULL-t engedők, filmnél `tmdb_collection_id` (a TMDB-gyűjtemény),
  `collection_checked_at`, `franchise_suggestion_off` (a felajánlott franchise-t elutasította) –
  `19_title_collection.sql` (terv-3 35), NULL-t engedők,
  `created_at`, `updated_at` (trigger); egyedi: `(user_id, media_type, tmdb_id)`
- `title_seasons (title_id FK → titles on delete cascade, season_number ≥ 1, user_id default
  auth.uid(), name, episode_count, air_date, status FK → statuses, is_downloaded, watched_at,
  created_at, updated_at)`, PK `(title_id, season_number)`, RLS – `08_title_seasons.sql`.
  Triggerek: megnézettre állításkor (átváltáskor) az évad `is_downloaded` hamis lesz, a
  `watched_at` a mai nap (más állapotnál üres); minden változás után a sorozat `status`,
  `is_downloaded`, `watched_at` mezője az évadokból számolódik: minden megjelent
  (`air_date` ≤ ma) évad megnézve → `watched`; van megkezdett / megnézett → `watching`;
  különben `to_watch`; letöltve = van letöltött évad. Évadok nélkül a cím kézi marad.
  A bejelentett évad (`air_date` üres vagy jövőbeli) nem számít a „minden megnézve” feltételbe.
  Kivétel a `dropped` (Abbahagyva): kézi, az évadok változása nem írja felül (csak a letöltve
  követi őket). Évados sorozat `status`-ának közvetlen írásakor (BEFORE UPDATE OF status trigger,
  `titles_status_from_seasons`) a `dropped` kivételével mindig az évadokból számolt érték kerül
  be (a `status`, `is_downloaded`, `watched_at` is) – így a „Mégis folytatom” bármit küldhet.
  Közös számítás: `seasons_summary(title_id)` – `09_dropped.sql`.
- `franchises (id, user_id default auth.uid(), name, created_at, logo_path, logo_checked_at,
  tmdb_collection_ids integer[] default '{}')` – felhasználónkénti saját lista, a felületen
  bővíthető; egyedi: `(user_id, lower(name))` – `04_franchises.sql`; logó:
  `07_franchise_logo.sql`; kézzel hozzárendelt TMDB-gyűjtemények: `13_franchise_collections.sql`
  (szándékosan NULL is lehet – az app üresnek veszi –, mert az oszlop előtti mentések
  visszaállításakor NULL kerül bele). **Általános szabály:** mentett táblába új oszlop csak
  NULL-t engedő (vagy a visszaállítás tölti ki), különben a régi mentések nem állíthatók vissza
- `franchise_order (franchise_id FK → franchises on delete cascade, title_id FK → titles on delete
  cascade, season_number ≥ 0 – 0: film / évad nélküli sorozat –, user_id default auth.uid(),
  position)`, PK `(franchise_id, title_id, season_number)`, RLS (a cím és a franchise is a
  felhasználóé) – `15_franchise_order.sql` (terv-3 28, 2026-10-06). Csak a sorrend; a megnézett
  állapot a címekből / évadokból jön. `set_franchise_order(franchise, items jsonb)` (a felhasználó
  jogaival, egy tranzakcióban cseréli). Trigger (`titles_franchise_order_moved`): más franchise-ba
  került cím kikerül a régi sorrendből (visszakerülve a végére jön). A mentésben is (version 2)
- `hidden_suggestions (user_id default auth.uid(), media_type, tmdb_id, title, poster_path,
  release_year, created_at)`, PK `(user_id, media_type, tmdb_id)`, RLS – `16_hidden_suggestions.sql`
  (terv-3 39, 2026-10-06): a „Nem érdekel”-lel elrejtett ajánlások; a cím / borító / év a
  „Elrejtett ajánlások” listához (TMDB-lekérés nélkül). A mentésben is (version 3)
- Trigger (`06_watched_clears_downloaded.sql`): amikor egy cím „Megnézve” állapotba kerül
  (átváltáskor vagy megnézettként felvéve), az `is_downloaded` hamis lesz; ha utána kézzel
  újra letöltöttnek jelölik, az megmarad. A felület is azonnal leveszi a pipát.
- `notifications (id, user_id default auth.uid(), title_id FK → titles on delete cascade,
  season_number, kind ('season_announced' | 'season_aired' | 'movie_digital' | 'mama_interested'), air_date,
  created_at, read_at, dismissed_at)`, egyedi `(title_id, season_number, kind)`, RLS – `10_notifications.sql`.
  `dismissed_at` (`18_notification_dismiss.sql`, NULL-t enged): a harangból törölt – a lista nem
  kéri le; a sor megmarad, így az egyedi kulcs miatt a gyűjtők nem írják újra (a `movie_digital`-t
  14 napig újraírnák); Mama újbóli „Érdekel”-je (`mama_mark`) üríti.
  `title_seasons.aired_notified`: szóltunk-e már az évad megjelenéséről.
  `collect_season_notifications()` (a felhasználó jogaival): a még nem jelzett, már megjelent
  évadokról értesítést ír (abbahagyott sorozatról és már megnézett évadról nem), és jelzettnek
  állítja őket. `collect_release_notifications()` (a felhasználó jogaival, `14_release_dates.sql`):
  `movie_digital` (filmnél `season_number = 0`, `air_date` = a digitális dátum) a friss –
  14 napon belüli – digitális megjelenésről, ha a film a felvételkor még nem jelent meg és nincs
  megnézve; filmenként egyszer (az egyedi kulcs)
- `backups (id, user_id default auth.uid(), kind ('weekly' | 'manual' | 'before_restore' |
  'imported'), created_at, title_count, data jsonb)` – `12_backups.sql`. A `data` a felhasználó
  sorai változatlanul (`to_jsonb`): `{ version: 3, franchises, titles, title_genres, genres,
  title_seasons, notifications, franchise_order, hidden_suggestions }` (`backup_snapshot(user)`;
  a version 1-es – 2026-10-06 előtti – mentésekben nincs `franchise_order`, azok sorrend nélkül
  állnak vissza; a version 1–2-esekben nincs `hidden_suggestions`: visszaállításukkor az elrejtett
  ajánlások nem változnak – `16_hidden_suggestions.sql`). RLS: a sajátját látja és törölheti,
  írni csak a függvények írnak. `write_backup(user, kind)`: üres listáról nem ment; mentés után
  a 8 hétnél (55 nap 23 óránál) régebbieket törli – üres listánál nem, így a régiek megmaradnak.
  `backup_all_users()`: pg_cron, `filmlista-heti-mentes`, hétfő 03:00 UTC. A felületről:
  `create_my_backup()`, `restore_my_backup(id)` (előbb `before_restore` mentés; töröl és az
  eredeti azonosítókkal visszatölt; a számlálókat továbbállítja). A belső függvényeket
  (`backup_snapshot`, `write_backup`, `backup_all_users`) anon / authenticated nem hívhatja.
  Visszaállítás alatt `set_config('filmlista.restoring', 'on', true)`: a
  `clear_downloaded_when_watched`, `title_seasons_before_write`, `sync_title_from_seasons`
  trigger ilyenkor nem módosít (különben a megnézett, de újra letöltött cím / évad jelét
  levennék) – ha ezeket a függvényeket módosítod, a jelző-vizsgálat maradjon az elejükön.
  `backup_reader` szerep: bejelentkezhet (jelszó csak a `.env.local`-ban és a GitHubon),
  csak olvas, csak a `backups` táblát látja (saját RLS-szabály). A `session_replication_role`
  itt nem állítható (nincs jog).
- `list_viewers (viewer_id uuid PK → auth.users, owner_id → auth.users, created_at)` – ki kinek a
  listáját nézi (terv-3 13, `17_mama_access.sql`): Mama (néző) → Norbi (gazda). RLS: a néző a saját
  sorát látja (ebből tudja az app, hogy Mama lépett be); írni csak SQL-ből (`munka/e2e/mama-kapcsolas.mjs`).
  A Mama-tesztfiók a tesztfiókhoz kötve. Nincs a mentésben (beállítás, nem lista-adat).
  **`mama_list()`** (security definer, csak `authenticated`): a hívó gazdájának filmjei – (megnézendő,
  franchise nélküli, jelöletlen, már megjelent – `title_released(t)`, a letöltöttek is) vagy
  `mama_status = 'interested'` (bármilyen állapotban, a Megkaptáig); `created_at desc`; csak a
  megjelenítéshez kellő oszlopok (`user_id`, saját értékelés, állapot soha). **`mama_mark(title_id,
  choice)`** ('interested' / 'declined' / null): csak Mama listáján lévő (vagy „Nem érdekli”) filmre,
  „Megkapta”-ra nem; csak a `mama_status`-t írja; „Érdekli”-re váltáskor `mama_interested` értesítés
  Norbinak (újbóli jelöléskor újra olvasatlan). **`title_released(t)`**: a `releaseState()` szabálya
  SQL-ben (ha az egyik változik, a másikat is módosítani kell). Mama a `titles` táblát közvetlenül nem
  látja. Teszt: `munka/e2e/test-17.mjs` (`--live`)
- `title_genres (title_id, genre_id)` – kapcsolótábla
- `titles_with_genres` nézet (`security_invoker`): `titles.*` + `status_name` + `genres text[]`
  + `seasons jsonb` (az évadok évadszám szerint; filmnél / évad nélkül `[]`)
- Minden táblán RLS: a felhasználó csak a saját címeit látja/módosítja.
- Sémamódosításnál új számozott SQL fájlt írj a `supabase/` mappába (pl. `05_...sql`).
  Ha a nézet oszlopai változnak (a `t.*` is!), újra kell létrehozni (`drop view` + `create view`).
- Futtatás: Claude a `SUPABASE_DB_URL`-lel (`.env.local`, Session pooler; teljes admin jog,
  RLS nélkül) a `pg` csomaggal, egy tranzakcióban (hibánál `rollback`). A `pg` a scratchpadbe
  települ, nem a projektbe. Csak a `supabase/` mappa számozott fájljait futtasd; adatot törlő
  vagy táblát eldobó lépés előtt kérdezz rá (a nézet újralétrehozása kivétel). Utána ellenőrizd.
  Push csak a séma után, mert az új kód az új oszlopokra/táblákra számít.

## Konvenciók
- Felületi szövegek magyarul, mondatkezdő nagybetűvel, cselekvő igékkel
  (pl. „Hozzáadás a listához”, nem „Submit”).
- Hibaüzenet mondja meg, mi a baj és mit tegyen a felhasználó.
- Az alapállapot (`to_watch`, `DEFAULT_STATUS`) a felületen **üresen** jelenik meg: nincs
  „Megnézendő” felirat a soron/kártyán/ablakban, és nincs színe. Csak a szűrőgomb nevezi meg.
  A szerkesztő ablakban a kiválasztott állapotra/Mamára újra kattintva lesz üres.
- A megnézett (`watched`) és az abbahagyott (`dropped`) címek háttérbe húzódnak (sor és kártya):
  fekete-fehér, fakó borító,
  tompított, de olvasható szöveg (`--watched-text`, ≥ 4,5:1), halványabb vezérlők, szürke
  műfajpötty, szürke „M” (Mama) – nem az egész sor átlátszó. Rámutatáskor és fókusznál
  minden teljes színű.
- Design: sötét téma a `:root` változókkal; kiemelőszín (`--accent`) neon türkiz `#33e0ef`
  (nem sárga), a „Folyamatban” is ez (`--st-watching: var(--accent)`); állapotszínek
  `--st-<kód>` változókban (Abbahagyva: halvány lila `--st-dropped`).
  Új állapotnál ide is kell egy szín, és a `[data-status=...]` szabály (kártya és táblázatsor is használja).
- Második kiemelőszín (`--accent-2`, borostyán `#ffb547`, `-ink`, `-soft`, `-line`): **csak a
  saját jelöléseken** – saját értékelés csillagai, Mama (szerkesztő chip, táblázat lenyíló,
  kártya), a harang száma. Soha nem gombszín; a türkiz marad a gomboké, az állapotoké, a
  kiválasztott szűrőké és a fókuszkereté.
- A színtokenek OKLCH-ban (`oklch(L% C h)`), mellettük megjegyzésben a hex: hagyományos (sRGB)
  kijelzőn pontosan az a szín. Széles színterű (P3) kijelzőn a `@media (color-gamut: p3)` szabály
  élénkebb `--accent` / `--accent-2`-t ad (ugyanaz a világosság és árnyalat, nagyobb
  telítettség). A build (Lightning CSS) a böngészőknek hex / `lab()` tartalékot is generál, ezért
  a számított érték `lab(…)` lehet – a teszt a színeket vásznon át, sRGB-ben hasonlítja (`rgbOf`).
  Új színt OKLCH-ban adj meg (hexből: `munka/dizajn-2/eszkozok/oklch.mjs`).
- Teli türkiz csak a fő műveleteknél (Cím hozzáadása, Mentés, Belépés); a kiválasztott állapot
  (szűrőgomb, aktuális oldal, választott lehetőség) `--accent-soft` háttér + `--accent-line` keret.
  A gombok kerek végűek, rámutatva világosodnak, lenyomva sötétednek (`--accent-hover/-press`,
  `--hover-tint/--press-tint`).
- Saját lenyíló-nyíl (`--chevron`, `appearance: none`) és jelölőnégyzet (`--check-mark`); ahol egy
  szabály `background` rövidítést ad egy lenyílónak, a nyilat is újra meg kell adni. Windows nagy
  kontrasztú módban a beépített vezérlők maradnak.
- Mozgás: legfeljebb ~0,2 s-os átmenetek. Kivételek („Mozgás” szakasz a `globals.css`-ben):
  az aurora (a lap tetején három elmosott fényfolt – türkiz, lila, borostyán – 36 s-os lassú
  lebegéssel, `body::before`; a belépési oldalon nincs, kétoldalt 4% hely + maszk, hogy ne
  legyen éle és vízszintes görgetés; nyitott ablaknál áll – az elmosott háttér mögött úgysem
  látszik, és így az elmosást nem kell képkockánként újraszámolni); a nézetváltás borító ↔ szerkesztő (0,3 s); a borítófal
  kártyáinak beúszása (a görgetés vezérli: `animation-timeline: view()`); lapozáskor a kártyák /
  táblázatsorok lépcsőzetes beúszása (terv-3 49.8, 2026-10-08: 0,3 s + elemenként 22 ms,
  `sibling-index()`; a `Watchlist` ~1,2 s-ig `data-paging` jelzőt ad a rácsra / a `tbody`-ra –
  `pageAnim` –, addig ez váltja a görgetéses beúszást); a csillagok
  pattanása (0,34 s, egymás után); a pipa bepattanása (átmenet, betöltéskor nem mozog); a harang
  rezzenése (0,9 s, egyszer); a csontváz csillogása (1,4 s, ismétlődik); az értesítősáv
  fogyó csíkja (a sáv ideje, 8 s, lineáris – a hátralévő időt mutatja); a kihúzás (terv-3 40,
  Norbi kérése, 2026-10-06): megnézettre váltáskor zöld vonal fut végig a címen (0,26 s), majd
  elhalványul – összesen 0,75 s, a kártyán és a soron (`.strike`, háttér-vonal, a színe a
  regisztrált `--strike-ink` változó); a nézési sorrendben 0,3 s alatt húzódik be és megmarad. A `globals.css`
  végén egy közös `prefers-reduced-motion: reduce` szabály minden átmenetet és animációt
  kikapcsol (a nézetváltás álelemeit is; a nézetváltást a kód el sem indítja).
- Görgetősáv (terv-3 49.10, 2026-10-08): saját, a `globals.css` elején – `::-webkit-scrollbar` (10 px,
  átlátszó sín, 6 px-es lekerekített halvány fogantyú, rámutatva türkiz, húzva teli türkiz); Firefoxban
  `scrollbar-width: thin`. Chrome / Edge alatt a `::-webkit-scrollbar` csak ott érvényes, ahol nincs
  `scrollbar-width` / `scrollbar-color` – ezeket ne add meg elemre (a `.discover-list`-ről ezért került le).
- Hiányzó borító: a `.thumb:empty` / `.poster-fallback` filmikont kap (`--icon-film`).
- Anyag: leheletnyi, álló filmszemcse a háttéren (`body::after`, rögzítve, a tartalom mögött);
  „squircle” sarkok (`corner-shape: squircle`, `@supports` mögött – Chrome / Edge 139+, máshol
  kerek): borító 22 px, kis borító 13 px, szerkesztő ablak 32 px, panelek 20 px, mezők 12 px;
  új lekerekített elemnél ide is kell (és a `::before` / `::after` keretnek is).
- Új dizájnötletnél: előbb előtte–utána képek (`munka/dizajn-2/eszkozok/`: pillanatkép,
  előnézet, kontrasztmérés), beépítés csak Norbi jóváhagyása után.
- A két megjelenési kör (2026-10-03–04) lezárult. Amit Norbi nem kért (magadtól ne
  javasold újra): álló betűs eredeti cím, színskálás IMDb-jelvény, választható színtéma / OLED
  fekete, 3D billenés a borítókon, plakátszerű tipográfia, számláló a fejlécben, „Ma este”
  kiemelt sáv, haladásgyűrű a sorozatoknál, egyedi helykitöltő a hiányzó borítóhoz; a kurzort
  követő fénylő kártyaélt beépítés után visszavonatta.
- **Új ablak (`<dialog>`) esetén mindig vizsgáld a kikattintásos bezárást** (Norbi kérése,
  2026-10-05): kell-e, és mikor ne zárjon (bevitel / szerkesztés / megerősítés / folyamatban lévő
  művelet közben) – `lib/useBackdropClose.js` (`canClose`); ha egy ablak szándékosan nem zár
  kikattintásra (pl. importablak beírt szöveggel), írd oda megjegyzésben és a CLAUDE.md-be. Ha az
  ablak egy másik `<dialog>`-on belül nyílik a React-fában, a külső `onClose` csak a sajátjára
  zárjon (`e.target === e.currentTarget`), mert a React a belső „close” eseményét is továbbítja.
- Képekhez sima `<img>`, nem `next/image`.
- Nincs middleware / proxy; az auth kliensoldali.
- **Felhasználói leírás** (`FELHASZNALOI-LEIRAS.md`): **időszakosan frissül, nem minden fejlesztés
  után** (Norbi döntése, 2026-10-06: a felület gyakrabban változik, mint amilyen gyakran a leírásnak
  követnie kell). A fejlesztés commitjában a leíráshoz (szöveg, képek, Változásnapló) ne nyúlj; a
  frissítés a roadmap végén álló, számozás nélküli **„Időszakos kézikönyv-frissítés”** pont, Norbi
  kérésére. Menete: a leírás legutóbbi commitja óta készült változások
  (`git log $(git log -1 --format=%H -- FELHASZNALOI-LEIRAS.md)..HEAD`) alapján a témák szerinti
  szakaszok (ha nincs ilyen, új szakasz a tartalomjegyzékkel együtt), a változott felület képei, az
  „Utolsó frissítés” dátuma, és a Változásnaplóba a közben elkészült változások (a saját napjukkal,
  legújabb felül). Norbi szemszögéből, a felület pontos feliratainak idézésével; tervezett, még el
  nem készült funkció nem kerül bele. **Hangnem** (Norbi kérése, 2026-10-06): könnyed, barátságos, tegező –
  rövid bevezető mondatok, „miért jó ez neked”, de a tények (feliratok, szabályok) pontosak
  maradnak; a Változásnapló sorai tömörek. A címsorokat ne írd át (a tartalomjegyzék és a
  Változásnapló hivatkozásai rájuk mutatnak). **Képek** (a frissítéskor): a változott felület
  `docs/kepek/` képeit generáld újra (`leiras-seed.mjs`, majd `leiras-kepek.mjs <név>`; a jelölők
  és a szöveg számai egyezzenek); új funkcióhoz, ha érdemes, új kép a szkriptbe. Utána a
  tesztfiókot ürítsd ki.

## Állapot
Kész: adatbázis, projektváz, belépés, lista + szűrők, GitHub, Vercel deploy,
TMDB kereső és hozzáadás (az `/api/tmdb/*` route-ok token nélkül 401-et adnak),
hozzáadás dátuma a kártyán, cím szerkesztése és törlése (`TitleEditor`),
asztali soros nézet soron belüli szerkesztéssel (`TitleTable`), csillagos értékelés,
„Mama” jelző, rendezés (hozzáadás, értékelés, megjelenés éve), letisztított szűrősor,
franchise-ok (beállítás + szűrő + törlés), neon türkiz színvilág,
TMDB leírás a cím mellett, IMDb-értékelés (OMDb) + rendezés szerinte, lapozás,
saját IMDb-értékelések és az IMDb-figyelőlista betöltése CSV-ből, franchise-logók a szűrőben,
megjelenés-frissítés (18 javaslat, 2026-10-03), keresés a listán, középre zárt belépés,
évadok a sorozatoknál (évadonkénti állapot és letöltve, a sorozat állapota ebből számolódik,
új évadok hetente a TMDB-ről; epizódszintű követés Norbi kérésére nem kell),
„Abbahagyva” állapot sorozatoknál, szűrők alapállapota + ↺ gomb, Letöltés szűrő (Összes /
Letöltött / Nem letöltött), mobilon a borító a szerkesztőt nyitja (az IMDb-re a cím visz),
asztali nézetben lista / rács váltó, telefonon 3 kártya egy sorban, értesítések haranggal (új
évad bejelentése / megjelenése), tömeges import, mentés letöltése (CSV), franchise átnevezése,
Mama-szűrő, hasonló címek a szerkesztő ablakban (TMDB-ajánlások, egy kattintással a listára),
app-ikon (filmcsapó) és manifest: Norbi asztali alkalmazásként a Chrome-ból telepítette
(Electron-csomag helyett), megjelenés 2. kör – színek (2026-10-04): borostyán második
kiemelőszín, OKLCH-színek + élénkebb neon P3 kijelzőn, műfajszínek, hangulatszín a borítóból,
aurora a lap tetején; anyag és mélység: letapadó üveg szűrősor, filmszemcse, squircle sarkok;
új felületek: háttérkép a szerkesztő ablakban, statisztika, telefonon alsó lap és lebegő „+”;
mozgás: nézetváltás borító ↔ szerkesztő, beúszó kártyák, mikroanimációk
(csillag, pipa, harang), csontváz-betöltés; listanézetben nagyobb borító (72 px) és cím (20 px);
automatikus heti mentés (2026-10-04): az adatbázisban 8 hétig (pg_cron), „Mentések” ablak
(mentés most, visszaállítás), külső másolat a GitHubon (artifact, 56 nap); a 3. tervkörből
(2026-10-04): értesítősáv, törlés visszavonása, „Hogy tetszett?” megnézéskor, barátságos üres
állapotok, gyorsgombok a letapadt szűrősorban, előzetes a szerkesztőben, évadok idővonala,
Felfedezés (magyar szinkronos közelítés), franchise-gyűjtemény a hiányzó részekkel.
Franchise-filmek importja (franchise.xlsx): 194 cím, 34 franchise; hozzáadás dátuma = megjelenés.
Marvel-import (2026-10-06, Norbi listája képről, szkripttel – `munka/terv-3/29-marvel/`): 85 cím a
„Marvel” franchise-ban (81 új, Megnézendő, hozzáadás dátuma = megjelenés; a TMDB magyar címei, a
változatjelölés – „Pókember 2.1”, „Bővített változat” – Norbi címéből; a Bosszúállók, Fekete Özvegy,
Shang-Chi, Morbius már a listán volt) és a 88 tételes nézési sorrend (filmek + évadok, Norbi
sorrendjében); előtte „Kézi” mentés.
Norbi listája (norbert.tutor@gmail.com) 2026-10-02-án Excelből importálva: 512 cím.
A még meg nem jelent filmek szaggatott kerettel és dátumos jelvénnyel, a harang szól a digitális
megjelenésről (2026-10-04, terv-3 10-es pontja szűrőgomb nélkül). Asztalon az adatlap
kikattintásra bezárul, ha nincs mentetlen módosítás (terv-3 24-es pontja, 2026-10-04). „Hol
nézhető?” az adatlapon (magyar streamingszolgáltatók logóval, terv-3 21), IMDb-figyelőlista
importja (terv-3 20), „Franchise-ok” ablak a ⋮ menüben (terv-3 23, 2026-10-05), kikattintásra záródó ablakok (terv-3 32),
adatlap a listára vétel előtt – előnézet a találatokból, a Felfedezésből és a Hasonló címekből,
„Vissza” gombbal (terv-3 31, 2026-10-05). Optimalizálás (terv-3 34, 2026-10-05–06): gyorsítótárak,
háttérfrissítés csak ha esedékes, helyi tokenellenőrzés, 1000 cím fölött is teljes lista. Nézési sorrend a franchise-okban: a gyűjtemény-ablak
„Nézési sorrend” fülén filmek és évadok saját sorrendben, a megnézett kihúzva, a fő listán „Nézési
sorrend” rendezés évadonkénti tételekkel (terv-3 28, 2026-10-06). „Nem érdekel” (×) a Felfedezés
és a Hasonló címek borítóin, „Elrejtett ajánlások” a Felfedezés alján (terv-3 39); kihúzás-animáció
megnézettre váltáskor (terv-3 40, 2026-10-06). Képes, barátságos hangvételű felhasználói leírás
(terv-3 33, 2026-10-06). Kiemelt sáv a Felfedezés tetején (terv-3 46, „A” változat, 2026-10-07).
Gyorsindítók a telepített app ikonján (terv-3 43, 2026-10-07). Ízlésprofil a Statisztikában (terv-3
42, 2026-10-07). **Mama külön hozzáférése** (terv-3 13, 2026-10-07): Mama
(tutorne.eva@gmail.com) saját fiókkal a „Norbi filmjei” oldalt látja („B” változat – nagy sorok,
Érdekel / Nem érdekel a sorban és az adatlapon); Norbinál „Nem érdekli” jelölés és „Mamát érdekli”
harang; a Mama-tesztfiók a tesztfiókhoz kötve. Értesítések törlése a harangból (×, „Összes törlése”,
visszavonható – 2026-10-07). Franchise-javaslat felvételkor és „Javasolt hozzárendelések” a
Franchise-ok ablakban (terv-3 35, csak felajánlja), „Neked ajánlott” sor a Felfedezésben (terv-3 37,
2026-10-07). Offline indulás (terv-3 44, 2026-10-08): service worker + a legutóbbi lista helyben –
azonnal megnyílik, net nélkül csak olvasható, utána magától frissül. Felhasználói leírás az appon
belül, a ⋮ menüből (terv-3 48, 2026-10-08).
Fejléc: „Megnézendő filmek és sorozatok” (a böngészőfül: „Megnézendő filmek”).

## Következő feladat
A 28-as (nézési sorrend) és a 29-es (a Marvel betöltése – Claude szkripttel, 2026-10-06) kész; a
29-es felületi része (tömeges import franchise-választóval, sorrend szövegből) Norbi döntése szerint
nem kell (2026-10-06) – ilyet Claude szkripttel tölt be; magadtól ne javasold újra.
A 34-es (erőforrás-optimalizálás + kinézeti hibák) is kész (2026-10-05 és 2026-10-06: E1–E6, K3,
az 1000 soros korlát kezelése); a C2 / C3 (látható változással járó könnyítések) Norbi döntése
szerint nem kell. A vizsgálat: `munka/optimalizalas/VIZSGALAT.md`.
**Becsült idő** (Norbi kérése, 2026-10-06: a roadmap listázásakor mindig írd mellé; teszttel és
doksival együtt; ha egy pont tartalma változik, frissítsd): a pontok mellett „~… óra”.
**Norbi kérései (2026-10-04)** – utána, ebben a sorrendben; a részletek
(megvalósítás, teszt) a `munka/terv-3/TERV.md` „▶ Következő kör” szakaszában:
1. **27 – jelszó módosítása** (~1,5 óra): csak bejelentkezve (e-mail-cím / ⋮ → „Jelszó módosítása”:
   jelenlegi + új kétszer; előbb ellenőrző belépés, utána `updateUser`). Elfelejtett jelszó a
   belépési oldalon **nem kell** (Norbi döntése, 2026-10-08) – magadtól ne javasold újra; így
   Supabase-beállítás sem kell.
(A 2026-10-05-i 33-as – képes felhasználói leírás – kész, 2026-10-06. A 13-as – Mama külön
hozzáférése – kész, 2026-10-07: Mama fiókja – tutorne.eva@gmail.com – Norbiéhoz kötve, élesben 141 film
látszik nála, ebből 24 „Érdekel”; napló: `munka/terv-3/13-mama/ALLAPOT.md`.)
**Norbi kérései (2026-10-05, funkciójavaslatokból)** – utánuk (a 35-ös – franchise-javaslat – és a
37-es – „Neked ajánlott” – kész, 2026-10-07):
2. **36 – új rész egy franchise-od TMDB-gyűjteményében → harang** (~2,5–3 óra) (hetente, az első feltöltés nem
   szól; kattintva előnézet).
**Norbi kérései (2026-10-06, javaslatokból)** – a 36-os után; a kinézeti pontoknál (45–47) **előbb
látványterv képekkel**, beépítés Norbi elfogadása után:
3. **41 – megosztható nézési sorrend** (~3 óra): egy franchise nézési sorrendjéhez csak olvasható
   nyilvános link (belépés nélkül, borítókkal, a megnézett állapot nélkül); visszavonható.
(A 39-es – „Nem érdekel” – és a 40-es – kihúzás – kész, 2026-10-06; a „Neked ajánlott” sorban is
van ×. A 46-os – kiemelt sáv –, a 43-as – gyorsindítók – és a 42-es – ízlésprofil – kész, 2026-10-07; a
44-es – offline indulás – kész, 2026-10-08. A 48-as – felhasználói leírás a ⋮ menüből – kész,
2026-10-08.)
**Norbi kérése (2026-10-08, Claude kinézeti javaslataiból)** – utána; mindegyik alpontnál **előbb
látványterv** (Norbi kéri, amelyikhez akarja), beépítés csak jóváhagyás után; részletek a TERV.md-ben:
4. **49 – látványosabb felület** (hátra ~2–2,5 óra; a 49.8 és a 49.10 kész, a 49.1 elvetve):
   - ~~49.1 – logó a cím helyett az adatlapon~~ – **elvetve** (Norbi, 2026-10-08: elkészült, de
     kipróbálás után visszavonatta – nem kell);
   - **49.3 – animált átrendeződés szűréskor / rendezéskor** (~2–2,5 óra): a kártyák és sorok a
     helyükre csúsznak, a kiesők elhalványulnak, az újak beúsznak;
   - ~~49.8 – lépcsőzetes beúszás lapozáskor~~ – **kész (2026-10-08, látványterv nélkül – Norbi kérése)**;
   - ~~49.10 – saját görgetősáv~~ – **kész (2026-10-08, látványterv nélkül)**.
**Lekerült a roadmapről** (Norbi döntése, 2026-10-08: a közeljövőben nincs tervben; magadtól ne
javasold újra): **25 – admin jogosultság**, **26 – regisztráció** (a meglévőkön kívül más felhasználó
nem lesz, Mama fiókja pedig a 13-as óta korlátozott). A részletes tervük a TERV.md-ben megmaradt.
**Számozás nélkül, mindig a roadmap végén** (Norbi kérése, 2026-10-06):
- **Időszakos kézikönyv-frissítés** (~1–2 óra, a közben összegyűlt változásoktól függően): a
  `FELHASZNALOI-LEIRAS.md` szövege, képei és Változásnaplója a legutóbbi frissítése óta elkészült
  fejlesztésekkel (menete: Konvenciók → „Felhasználói leírás”). Norbi kéri, amikor esedékes; utána
  is a lista végén marad.

## Fejlesztési terv, 3. kör (2026-10-04)
**`munka/terv-3/TERV.md`** (helyi mappa) – a hátralévő pontok (a „Következő feladat” pontjai)
részletes leírása: mit lát Norbi, megvalósítás (fájlok, SQL, TMDB-hívások), teszt, méret; közös
alapok és „hogyan kezdj neki”. Előnézet a kör eredeti 21 javaslatáról (privát):
https://claude.ai/artifact/XWwxnuv2juKRmSEJR3WLUa (helyben `munka/terv-3/tervek.html`).
Megvalósításkor a pont mellé a TERV.md-be: „kész (commit)”, és ide az Állapotba; a
`FELHASZNALOI-LEIRAS.md`-be csak az időszakos kézikönyv-frissítéskor kerül (lásd Konvenciók).
**Kész (2026-10-04), Norbi döntéseivel:** 1 – törlés visszavonása (a szerkesztő ablakban marad
a megerősítés), 4 – értékelés kérése (nem kikapcsolható), 7 – előzetes, 8 – Felfedezés (csak
magyar szinkronos – közelítés, külön sorozat-sorral), 9 – franchise-gyűjtemény, 14 – üres
állapotok, 15 – gyorsgombok a letapadt szűrősorban, 16 – évadok idővonala; 10 – a még meg nem
jelent filmek (szaggatott keret + jelvény + harang; szűrőgomb Norbi kérésére nincs); 24 –
kikattintásra bezáruló adatlap; 20 – IMDb-figyelőlista importja; 21 – „Hol nézhető?” csak az
adatlapon; 22 – telefonon nincs „IMDb import”; 23 – „Franchise-ok” ablak (2026-10-05); 32 – kikattintás a Statisztika, Franchise-ok, gyűjtemény és
Mentések ablakon is (2026-10-05); 31 – adatlap a listára vétel előtt (a találatokból, a
Felfedezésből és a Hasonló címekből; felvétel után helyben rendes adatlap, 2026-10-05); 28 –
nézési sorrend a franchise-gyűjteményben (külön fül, a fő listán évadonkénti tételekkel, 2026-10-06).
29 – Marvel betöltve a sorrenddel (szkripttel, 2026-10-06); 39 – „Nem érdekel” az ajánlásokon, 40 –
kihúzás-animáció (2026-10-06, videó nélkül – Norbi kérése). 34 – optimalizálás (E1–E6, K3, 1000 soros korlát, 2026-10-05–06). Vár még: 27, 36, 41, 49 (kinézeti újítások, látványtervvel) („Következő feladat”; a 25 és a 26 lekerült – Norbi, 2026-10-08); 48 – felhasználói leírás a ⋮ menüből kész (2026-10-08, belső ablakban); 44 – offline indulás kész (2026-10-08); 35 – franchise-javaslat és 37 – „Neked ajánlott” kész (2026-10-07); 13 – Mama külön hozzáférése kész (2026-10-07, 5 lépésben, „B” változat); 42 – ízlésprofil kész (2026-10-07); 43 – gyorsindítók kész (2026-10-07); 46 – kiemelt sáv a Felfedezés tetején kész (2026-10-07, „A” változat); 33 – képes, barátságos felhasználói leírás kész (2026-10-06); 47 – csempék hangulatszíne kész (2026-10-06, látványterv nélkül); 38 – szereplők az adatlapon kész (2026-10-06, „A” változat); 45 – háttérképes franchise-sáv kész (2026-10-06, látványterv nélkül – Norbi kérése); 30 – tömörebb adatlap kész
(B – vezérlősáv, 2026-10-05).
**Elvetve (Norbi, 2026-10-05):** „Elérhető az előfizetéseimen” szűrő, megosztás telefonról az
appba (share target), adatminőség-ellenőrző; nem választotta: „Letölthető most” gyorsnézet,
megjelenési naptár, figyelmeztetés hasonló címre, mentett szűrő-összeállítások, díjak az
adatlapon, alsó navigációs sáv telefonon, aktivitás-hőtérkép, rámutatásra leírás a borítófalon,
sűrűségváltó, fülek az adatlapon telefonon – magadtól ne javasold újra. A 34-esből elvetve
(Norbi, 2026-10-06): C2 – csak a borító siklik a megnyitáskor, C3 – kisebb üvegelmosás. A 2026-10-06-i javaslatokból nem választotta: újranézés-napló, „Rég láttad”
ajánló, változásnapló visszavonással, görgetésre mozduló háttérkép az adatlapon, előzetes rámutatásra a
Felfedezésben – magadtól ne javasold újra. A 2026-10-08-i kinézeti javaslatokból (49) elvetve: mozgó
borítófal a belépési oldalon, elmosottból kiélesedő borítók, kedvencek borostyán kerete, szikrák 10
csillagnál, felpörgő számok / felnövő oszlopok a Statisztikában, feltöltődő franchise-mérők, címlogó az adatlapon
(49.1 – beépítve, majd visszavonva) –
magadtól ne javasold újra.
**Elvetve (Norbi kérésére, 2026-10-04) – nem kell, magadtól ne javasold újra:** 2 – gyorsműveletek a borítón, 3 – parancspaletta (Ctrl+K) és billentyűparancsok, 5 – „Mit nézzek ma?”, 6 – játékidő a soron és szűrő rá, 11 – saját címkék, 12 – szinkron / felirat jelölése, 17 – csoportosítás hónapok szerint, 18 – évértékelő, 19 – értesítés a telefonra (web push).

## Fejlesztői megjegyzés
- Ha a terminál nem ismeri a `node`/`npm` parancsot, a VS Code-ot újra kell indítani
  (a Node a `C:\Program Files\nodejs` mappában van).
- Tesztfelhasználó: `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` a `.env.local`-ban – külön
  Supabase-fiók, az RLS miatt Norbi listáját nem látja. Soha ne írd ki az értékeit.
  Böngészős teszt: `playwright-core` a scratchpadbe telepítve (nem a projektbe), a gépen
  lévő Chrome-mal (`C:\Program Files\Google\Chrome\Application\chrome.exe`), a helyben
  futó `npx next start -p 3123` ellen. A teszt végén a tesztfiók listáját ürítsd ki.
  A teszt és a segédszkriptek a helyi `munka/` mappában vannak (git-ből kizárva, lásd
  `munka/README.md`): a scratchpadbe másolva, ott `npm install` után futtathatók.
  Szkriptből (supabase-js) kilépéskor `signOut({ scope: 'local' })` kell – az alapértelmezett
  `global` a böngészőben futó munkamenetet is lezárja, és az `/api` route-ok 401-et adnak.
  A böngészős teszt „kevesebb mozgás” módban fut (`emulateMedia({ reducedMotion: 'reduce' })`),
  hogy a nézetváltás és az animációk ne zavarják a lépéseket; a mozgást a saját lépése kapcsolja
  vissza és ellenőrzi. Újratöltéskor előbb a helyben tárolt lista látszik (terv-3 44): a teszt
  `page.reload`-ja megvárja a frisset (`main[data-list]`: `loading` | `stale` | `live`), a
  `plainReload` nem vár; a `clearSnapshot()` törli a tárolt listát (pl. a csontváz próbájához).
  Képernyőkép / videó a tesztfiókról: a fejléc e-mail-címét mintacímre kell cserélni
  (`munka/dizajn-2/eszkozok/mask.mjs`); videóhoz a Playwright ffmpeg-je a scratchpadbe kerül
  (`PLAYWRIGHT_BROWSERS_PATH`), lásd `munka/dizajn-2/eszkozok/video*.mjs`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
