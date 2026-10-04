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
  név: „Megnézendő filmek”, `theme_color` = `--bg-top`). Ellenőrzés: `munka/e2e/verify-ikon.mjs`
- `app/page.js` – kliensoldali session-kezelés: belépés vagy lista
- `components/LoginForm.js` – e-mail + jelszó belépés (regisztráció nincs, ki van kapcsolva);
  minden középen: cím, alatta az űrlap (nagyobb kijelzőn kártyán, felülről halvány türkiz fény)
- `components/Watchlist.js` – lista betöltése a `titles_with_genres` nézetből; fejléc:
  „Megnézendő filmek és sorozatok”; mellette (jobbra) „Cím hozzáadása”, harang (`NotificationBell`),
  e-mail, Kilépés, a sor végén a „További műveletek” (⋮) menü (`MoreMenu`, Norbi kérése, mint a
  Chrome-ban): „IMDb értékelések”, „Statisztika” (`StatsDialog`), asztali nézetben „Tömeges
  import” (`BulkImport`) és „Mentés letöltése” (`downloadListCsv`). Telefonon (≤ 640 px) a
  „Cím hozzáadása” helyett lebegő, kerek „+” gomb a jobb alsó sarokban (`.fab`; lefelé
  görgetéskor elhúzódik, felfelé visszajön – ugyanaz a görgetésfigyelő, mint a szűrősoré;
  kattintva megnyitja a keresőt és a lap tetejére görget); szűrősor
  balról: Típus lenyíló (Filmek / Sorozatok; kiválasztott franchise vagy keresés
  mellett plusz „Filmek és sorozatok” – `type: 'all'`, ami franchise választásakor
  automatikusan beáll, a franchise-szűrő megszüntetésekor vissza Filmek) – állapotgombok
  (mobilon, ≤ 640 px: lenyíló a típus mellett; az „Abbahagyva” csak Sorozatok / Filmek és
  sorozatok típusnál) + Letöltés lenyíló (Összes / Letöltött / Nem letöltött) – Műfaj (csak az
  adott típus műfajai) – Mama (Összes / Érdekli / Megkapta; csak ha van Mama-jelölés) –
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
  üres érték a végére), a sor legvégén (csak ≥ 1400 px-en) felirat nélküli nézetváltó: két
  ikongomb, lista (táblázat, `TitleTable`) | rács (borítófal) – `aria-pressed`, `title`; a
  választást a böngésző megjegyzi (`localStorage`, `filmlista-nezet`), alapból lista;
  1400 px alatt mindig borítófal. Borítófal: telefonon (≤ 640 px) 3 kártya egy sorban (kisebb
  betűk és csillagok, a „Letöltve” jelvény csak ikon), asztali rácsban `minmax(185px)` kártyák.
  Az állapotgombok darabszámai a többi szűrőt már figyelembe veszik.
  A most szerkesztett sor a szűrés változásáig a helyén marad (`kept`), akkor is, ha már nem
  illik a szűrőbe (pl. „Nem letöltött” nézetben letöltöttnek jelölve) – így visszavehető.
  Üres találatnál „Szűrők törlése” (minden cím látszik) vagy keresésnél „Keresés törlése”.
  Lapozás 25-ösével (`PAGE_SIZE`, `components/Pagination.js`), szűrés/rendezés/keresés
  váltásakor 1. oldal (akkor is, ha később ugyanaz a szűrés jön vissza); lapozáskor a szűrősor
  eredeti helyére görget (egy üres jelölő a szűrősor előtt – a letapadt sorhoz nem lehetne).
  A szűrősor görgetéskor a lap tetejére tapad (`position: sticky`); letapadva (`data-stuck`, a
  Watchlist egy görgetésfigyelője jelzi) áttetsző, elmosott üveg; a magasságát
  (`--filters-h`, ResizeObserver) a táblázat ragadós fejléce kapja, hogy alatta tapadjon;
  telefonon kinyitva legfeljebb a képernyő 70%-a, belül görgethető
- `components/PosterCard.js` – borító (`https://image.tmdb.org/t/p/w342` + `poster_path`),
  állapotcsík, „Letöltve” jelvény; a borítóra kattintva a szerkesztő ablak nyílik (mint a
  ceruzával – Norbi kérése), az IMDb- (vagy TMDB-, ha nincs IMDb ID) adatlapra csak a cím visz
  (halvány aláhúzással), „Hozzáadva: <dátum>” a `created_at` alapján (csak megjelenítés, nem
  szerkeszthető), saját értékelés kis csillagsorként (`StarsDisplay`), ceruza gomb a bal felső
  sarokban → szerkesztő ablak (billentyűzettel / felolvasóval ez a borító-kattintás megfelelője);
  „Mama: …” borostyánnal (`.mama-tag`), műfajok színes pöttyel (`GenreList`); az első
  rámutatáskor kiszámolja a borító hangulatszínét (`usePosterColor`), rámutatva a borító ebben fénylik
  (a kurzort követő „fénylő kártyaél” 2026-10-04-én Norbi kérésére kikerült)
- `components/GenreList.js` + `lib/genreColors.js` – műfajok, mindegyik előtt kis színes pötty
  (`genreColor(név)`: OKLCH, egyforma világosság, a rokon műfajok rokon színt kapnak; ismeretlen
  műfaj szürke; a kulcs a TMDB magyar műfajneve); felolvasónak vesszővel elválasztva (`sr-only`).
  A kártyán és a táblázat sorában; megnézett / abbahagyott címnél a pötty szürke
- `lib/posterColor.js` – hangulatszín a borítóból: `usePosterColor(poster_path, enabled)` a kis
  (w185) borítót vászonra rajzolja (a TMDB képszervere CORS-t enged, de csak CORS-os kérésre: a
  w185-ös borítót ezért máshol ne töltsd be `crossOrigin` nélkül – a gyorsítótárból engedély
  nélküli választ kapna, ahogy a harang w92-es képeinél történt), a legjellemzőbb élénk
  színt adja OKLCH-ban, rögzített világossággal (0,72) és telítettséggel (0,04–0,13) – így a
  szövegek olvashatósága nem változik; borítónként egyszer számol (`Map`). `ambientProps(szín)`:
  `--ambient` CSS-változó + `data-ambient` jelző; a CSS („Hangulatszín a borítóból” szakasz)
  csak ilyenkor színez: a szerkesztő ablak a borító mögül dereng (színezett keret, árnyék,
  háttér), a kártya rámutatva fénylik, a táblázat rámutatott sora halványan színeződik
- `components/TitleEditor.js` – natív `<dialog>` (fejlécben a leírás): állapot, letöltve, megnézve dátuma
  (`watched_at`, csak „Megnézve” állapotnál; átváltáskor a mai nap), értékelés 10 csillaggal
  (+ „Törlés” link), törlés megerősítéssel (a mobilos borítófalon a borító vagy a ceruza nyitja).
  Az „Abbahagyva” állapot csak sorozatnál választható. Alul „Hasonló címek” (`SimilarTitles`).
  Asztalon (≥ 900 px) széles, kétoszlopos ablak: balra nagy borító (w500, görgetéskor a helyén
  marad; borító nélkül filmikon), jobbra az adatok; telefonon egy oszlop, nagy borító nélkül.
  Nézetváltás (asztalon, `lib/viewTransition.js`): a kattintott kártya / sor borítója átsiklik a
  nagy borító helyére (a `Watchlist` `openEditor(t, forrásElem)` indítja), bezáráskor (Esc –
  `cancel` elkapva –, Mégse, Mentés) a `morphTo` borítóra vissza; törléskor nincs. A
  `showModal()` ezért `useLayoutEffect`-ben fut.
  Megnyitáskor a fókusz az ablak címén van (keret nélkül), nem a Franchise mezőn (Norbi kérése).
  Ha van háttérképe (`backdrop_path`), az ablak tetején a film széles jelenetképe (`w1280`,
  telefonon `w780`), alul a felületbe olvadva; asztalon a nagy borító ráúszik a kép aljára
  (`.has-backdrop`). Telefonon (≤ 640 px) az ablak alsó lap: alulról felcsúszik, teljes
  szélességű, felül fogantyú (`.sheet-handle`) – lefelé húzva (110 px vagy gyors mozdulat)
  bezárul, különben visszaugrik.
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
  „+ Évad hozzáadása”, „Utolsó évad törlése” megerősítéssel – ha a TMDB-n is
  szerepel, a heti frissítés üresen visszahozza; abbahagyott sorozatnál a lista tetején lila
  sáv), `SeasonCell` (táblázat Állapot cellája: csík + „x/y évad”, ami lenyíló panelt nyit,
  alatta „Abbahagyva”, ha az; kívülre kattintás / Esc bezár), `SeasonDownloads`
  (Letöltve cella: a letöltött évadok). „Abbahagyva” (sorozat, amit Norbi nem néz tovább, de a
  listán marad): kézi, az évadjelölés és az új évad sem írja felül; a „Mind megnézve” feloldja
  (→ Megnézve, a visszavonás az Abbahagyva-t is visszaadja); a „Mégis folytatom” után az
  adatbázis az évadokból számol
- `components/TitleTable.js` – asztali soros nézet (≥ 1400 px, `DESKTOP_QUERY` a
  `Watchlist`-ben; `table-layout: fixed`, minden maradék hely a címoszlopé): balra borító (gomb:
  rákattintva a szerkesztő ablak – részletek, hasonló címek; rámutatva türkiz keret) +
  adatok (a cím mindig egy sorban, ha így sem fér ki „…” + tooltip; a műfajok külön sorban)
  + Franchise lenyíló saját, fix `11rem` (176 px) oszlopban, középre igazítva (Norbi
  leghosszabb franchise-neve is kifér); üresen átlátszó, de a helyét megtartja (így a sorok nem
  ugrálnak), rámutatáskor / billentyűzetes fókusznál látszik + TMDB leírás (`overview`;
  ≥ 1900 px egymás mellett: borító | cím oszlop fix `18rem` (288 px, Norbi címeinek kb. 96%-a
  belefér, a hosszabbak „…”-val) | franchise | leírás, a franchise két oldalán egyforma
  rácsköz, a leírás minden sorban ugyanott kezdődik, minden maradék helyet megkap, a
  „Letöltve” felirat felé 120 px (`--overview-gap-end`), 4 sorban; 1440p-re (2560 px)
  optimalizálva; 1900 px alatt a franchise a cím adatai mellett, a leírás alattuk 2 sorban;
  teljes szöveg rámutatáskor),
  jobbra sorrendben Letöltve – Állapot – Mama (kitöltve borostyán: `.mama-set`) – Értékelés
  (10 másfélszeres csillag középen, mellette „8/10”), a végén törlés megerősítéssel (a sor
  halvány pirosat kap). A sor az első rámutatáskor / fókusznál kiszámolja a borító
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
  mozgás”, az elem a lapon van) és `MORPH_NAME` (`editor-poster`)
- `lib/useMediaQuery.js` – `useMediaQuery(query)` hook (`useSyncExternalStore`)
- `components/SiteFooter.js` – kötelező TMDB forrásmegjelölés, ne töröld
- `components/TitleSearch.js` – „Cím hozzáadása” panel: késleltetett (400 ms) TMDB keresés,
  találati lista, „Hozzáadás a listához” gomb; a már listán lévőknél „✓ A listán”
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
  Közös segédek: `externalLink()`, `formatDate()`, `todayDate()`, `DEFAULT_STATUS`,
  `DROPPED_STATUS` („Abbahagyva”, csak sorozatnál), `MAMA_OPTIONS`, `mamaLabel()`
- `lib/server/auth.js` – `getUserFromRequest()`, `supabaseAsUser()` (a felhasználó nevében,
  RLS-sel), `unauthorized()` (csak route handlerben)
- `lib/server/tmdb.js` – `tmdbFetch()`, `tmdbErrorResponse()`, `yearOf()`, `pickSeasons()`
  (a TMDB évadjai a „0. évad” – különkiadások – nélkül) (csak route handlerben)
- `app/api/tmdb/search/route.js` – `GET ?q=` → `search/multi`, csak film/sorozat
- `app/api/tmdb/details/route.js` – `GET ?type=movie|tv&id=` → a `titles` oszlopainak
  megfelelő objektum + `genres [{id, name}]`, sorozatnál `seasons` is; magyar leírás híján
  angol; az IMDb-értékelést is lekéri (OMDb), ha nem sikerül, a cím attól még felvehető
- `app/api/tmdb/seasons/route.js` – `POST`: a még nem vagy 7 napnál régebben ellenőrzött
  sorozatok évadait frissíti a TMDB-ről (új – megjelent vagy bejelentett – évad, név,
  epizódszám, dátum; az állapothoz / letöltve jelzőhöz nem nyúl), 10-esével; a frissített
  sorokat adja vissza. A `Watchlist` betöltéskor hívja. Értesítés: ha egy már ismert évadlistájú
  (nem abbahagyott) sorozathoz új, még meg nem jelent évad érkezik → `season_announced`; az új,
  már megjelent évadot `aired_notified = false`-szal veszi fel (arról a gyűjtés szól); az első
  feltöltésnél a megjelentekről nem szól
- `app/api/tmdb/similar/route.js` – `GET ?type=movie|tv&id=` → a TMDB ajánlásai (ha nincs, a
  hasonlók), csak borítóval, legfeljebb 12, a kereséssel azonos mezőnevekkel
- `app/api/tmdb/backdrops/route.js` – `POST`: a még meg nem nézett címek (`backdrop_checked_at`
  üres) háttérképét lekéri a TMDB-ről és elmenti (40-esével, a felhasználó jogaival; ha nincs
  háttérkép vagy a cím már nincs a TMDB-n, csak megjelöli). A `Watchlist` betöltéskor hívja
  (`refreshBackdrops()`, legfeljebb 30 kör). Az új címek felvételkor kapják meg (a details
  route adja a `backdrop_path`-t és a `backdrop_checked_at`-et)
- `components/MoreMenu.js` – a fejléc „További műveletek” (⋮) menüje: kerek gomb (a harang
  mintájára, `aria-haspopup="menu"`), alatta jobbra igazított lista (`role="menu"`); minden pont
  ikonnal, címmel és rövid leírással (a korábbi súgók helyett; `aria-labelledby` /
  `aria-describedby`). Kattintással vagy Enter / Szóköz / nyilakkal nyílik, a menüben nyilak,
  Home / End, Esc (a fókusz vissza a gombra), Tab és kívülre kattintás bezárja. Választáskor a
  fókusz a gombra kerül (a megnyíló ablak bezárásakor oda tér vissza). A pontok:
  `{ id, label, description, icon, onSelect }` (ikonok: star, chart, list, download)
- `components/StatsDialog.js` + `lib/stats.js` – „Statisztika” ablak (a ⋮ menüből): csempék
  a betöltött listából (`listStats()`, adatbázis-lekérdezés nélkül) – megnézve az utolsó 12
  hónapban, havonta megnézett címek (saját SVG-oszlopdiagram, `watched_at`), műfajok (a
  műfajszínekkel), saját és IMDb-átlag, letöltve de még nem látott (az abbahagyottak nélkül),
  legtöbb cím franchise-onként, folyamatban lévő sorozatok évadhaladása; telefonon egy oszlop
- `components/SimilarTitles.js` – „Hasonló címek” a szerkesztő ablak alján: lenyitó gomb (alapból
  nyitva; ha becsukja, a böngésző megjegyzi: `localStorage`, `filmlista-hasonlok`; nyitva tölt be;
  telefonon – ≤ 640 px – mindig csukva indul, Norbi kérése, és ott a nyitás / csukás nem
  jegyződik meg),
  vízszintesen görgethető borítósor (évszám, típus; a borító a TMDB-adatlapra visz), „+ Hozzáadás”
  (`addTitle()`), a listán lévőknél „✓ A listán”
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
  ha nincs logó, 7 napig nem próbálja újra. A `Watchlist` betöltéskor hívja
- `components/ImdbRatingsImport.js` + `lib/imdbImport.js` – „IMDb értékelések” a ⋮ menüből
  (`ref.current.open()` → rejtett fájlválasztó; a komponens csak a fájlmezőt és az ablakot
  rajzolja): az IMDb értékelés-exportjából (CSV: `Const`, `Your Rating`)
  a böngészőben IMDb ID alapján párosít, összefoglalót mutat, majd `applyMyRatings()`
  (csillagértékenként egy update). Norbi döntései: csak a listán lévő címek, az IMDb csillaga
  felülírja a sajátot, az állapot nem változik, új cím nem kerül fel. Teljesen automatikus
  szinkron nincs (az IMDb-nek nincs API-ja, az oldal gépi olvasása tiltott).
- `components/NotificationBell.js` + `lib/notifications.js` – harang a fejlécben: a nem olvasott
  értesítések száma borostyán jelvényben (`--accent-2`); kinyitva a legutóbbi 30 (új évad bejelentése / megjelenése,
  borítóval); kinyitáskor mind olvasott (az adatbázisban is, `markNotificationsRead()`; a
  közben beérkező régi lekérdezés sem írja vissza – `readIds` a Watchlistben); elemre
  kattintva a sorozat szerkesztő ablaka; kívülre kattintás / Esc bezár. A lista a harang bal széléhez igazodik, ha ott
  kilógna, a jobbhoz (`lib/popupSide.js`, nyitáskor mérve – a ⋮ menü is így); telefonon teljes
  szélességű. A fejléc felugró listái (`z-index: 35`) a letapadó szűrősor (30) fölött vannak. `loadNotifications()`: előbb
  `collect_season_notifications()` (RPC), aztán a lista; a Watchlist betöltéskor és az
  évadfrissítés után hívja. A telepített app ikonján `navigator.setAppBadge()` mutatja a számot.
  Ha nő az olvasatlanok száma (betöltéskor is, ha van), a harang egyszer megrezzen (`.ringing`)
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
- `supabase/*.sql` – a már lefuttatott adatbázis-szkriptek (dokumentáció)

## Adatbázis (már létezik, lásd `supabase/`)
- `genres (id integer PK = TMDB műfaj ID, name)` – bejelentkezve olvasható/írható
- `statuses (code PK, name, sort_order)` – kódok: `to_watch`, `watching`, `watched`,
  `dropped` (Abbahagyva – `09_dropped.sql`; a felület csak sorozatnál kínálja)
- `titles` – `user_id` (default `auth.uid()`), `media_type` ('movie' | 'tv'), `title`,
  `original_title`, `release_year`, `overview`, `poster_path`, `tmdb_id`, `imdb_id`,
  `status` (FK → statuses), `is_downloaded`, `mama_status` (null | 'interested' | 'received',
  „Mama” jelző: üres / Érdekli / Megkapta – `03_mama.sql`), `franchise_id` (FK → franchises,
  null = nincs; `on delete set null`), `imdb_rating` (numeric 0–10), `imdb_votes`,
  `imdb_rating_updated_at` (`05_imdb_rating.sql`), `my_rating` (1–10), `notes`, `watched_at`,
  `seasons_checked_at` (mikor nézte az app a TMDB-n a sorozat évadait – `08_title_seasons.sql`),
  `backdrop_path` (a TMDB széles jelenetképe a szerkesztő ablakhoz), `backdrop_checked_at` (mikor
  néztük meg – `11_backdrop.sql`),
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
- `franchises (id, user_id default auth.uid(), name, created_at, logo_path, logo_checked_at)` –
  felhasználónkénti saját lista, a felületen bővíthető; egyedi: `(user_id, lower(name))` –
  `04_franchises.sql`; logó: `07_franchise_logo.sql`
- Trigger (`06_watched_clears_downloaded.sql`): amikor egy cím „Megnézve” állapotba kerül
  (átváltáskor vagy megnézettként felvéve), az `is_downloaded` hamis lesz; ha utána kézzel
  újra letöltöttnek jelölik, az megmarad. A felület is azonnal leveszi a pipát.
- `notifications (id, user_id default auth.uid(), title_id FK → titles on delete cascade,
  season_number, kind ('season_announced' | 'season_aired'), air_date, created_at, read_at)`,
  egyedi `(title_id, season_number, kind)`, RLS – `10_notifications.sql`.
  `title_seasons.aired_notified`: szóltunk-e már az évad megjelenéséről.
  `collect_season_notifications()` (a felhasználó jogaival): a még nem jelzett, már megjelent
  évadokról értesítést ír (abbahagyott sorozatról és már megnézett évadról nem), és jelzettnek
  állítja őket
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
  műfajpötty, tompa „Mama” felirat – nem az egész sor átlátszó. Rámutatáskor, fókusznál és a
  törlés megerősítésekor minden teljes színű.
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
  legyen éle és vízszintes görgetés); a nézetváltás borító ↔ szerkesztő (0,3 s); a borítófal
  kártyáinak beúszása (a görgetés vezérli: `animation-timeline: view()`); a csillagok
  pattanása (0,34 s, egymás után); a pipa bepattanása (átmenet, betöltéskor nem mozog); a harang
  rezzenése (0,9 s, egyszer); a csontváz csillogása (1,4 s, ismétlődik). A `globals.css`
  végén egy közös `prefers-reduced-motion: reduce` szabály minden átmenetet és animációt
  kikapcsol (a nézetváltás álelemeit is; a nézetváltást a kód el sem indítja).
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
- Képekhez sima `<img>`, nem `next/image`.
- Nincs middleware / proxy; az auth kliensoldali.

## Állapot
Kész: adatbázis, projektváz, belépés, lista + szűrők, GitHub, Vercel deploy,
TMDB kereső és hozzáadás (az `/api/tmdb/*` route-ok token nélkül 401-et adnak),
hozzáadás dátuma a kártyán, cím szerkesztése és törlése (`TitleEditor`),
asztali soros nézet soron belüli szerkesztéssel (`TitleTable`), csillagos értékelés,
„Mama” jelző, rendezés (hozzáadás, értékelés, megjelenés éve), letisztított szűrősor,
franchise-ok (beállítás + szűrő + törlés), neon türkiz színvilág,
TMDB leírás a cím mellett, IMDb-értékelés (OMDb) + rendezés szerinte, lapozás,
saját IMDb-értékelések betöltése CSV-ből, franchise-logók a szűrőben,
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
(csillag, pipa, harang), csontváz-betöltés.
Franchise-filmek importja (franchise.xlsx): 194 cím, 34 franchise; hozzáadás dátuma = megjelenés.
Norbi listája (norbert.tutor@gmail.com) 2026-10-02-án Excelből importálva: 512 cím.
Fejléc: „Megnézendő filmek és sorozatok” (a böngészőfül: „Megnézendő filmek”).

## Következő feladat
- Nincs kijelölve – Norbi kéri a következőt (ötletek lent).

## Fejlesztési ötletek (később)
- „Hol nézhető?” – a TMDB `watch/providers` adatai (Magyarország: Netflix, HBO Max, Disney+,
  SkyShowtime…) logóval a soron / kártyán, szűrő az előfizetett szolgáltatókra; a TMDB a
  JustWatch megnevezését kéri. Norbi: egyelőre nem kell, a lista végére.
- „Mit nézzek ma?” – véletlen ajánlás a jelenlegi szűrőből (pl. letöltött, még nem látott).
- Előzetes (trailer) link a szerkesztő ablakban (TMDB `videos`).
- Filmek megjelenésének figyelése – „Hamarosan” jelzés, és a harang szól, ha letölthető lett
  (TMDB `release_dates`, digitális megjelenés).
- Játékidő a soron (sorozatnál egy rész hossza) és szűrő rá (pl. 2 óránál rövidebb).
- Értesítés a telefonra akkor is, ha az app nincs nyitva (web push, napi ellenőrzés).
- Saját címkék (pl. „családi”, „karácsonyi”) szűrővel.
- Mamának megosztható, csak olvasható lista titkos linkkel (gondos jogosultságkezeléssel).
- Szinkron / felirat jelölése a letöltött címeknél.
- Automatikus heti mentés az adatbázisba (néhány hétre visszaállítható).
- Törlés visszavonása (megerősítés helyett pár másodpercig „Visszavonás”).
- Billentyűparancsok asztalon (`/` keresés, `N` új cím, nyilak: lapozás).

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
  vissza és ellenőrzi.
  Képernyőkép / videó a tesztfiókról: a fejléc e-mail-címét mintacímre kell cserélni
  (`munka/dizajn-2/eszkozok/mask.mjs`); videóhoz a Playwright ffmpeg-je a scratchpadbe kerül
  (`PLAYWRIGHT_BROWSERS_PATH`), lásd `munka/dizajn-2/eszkozok/video*.mjs`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
