# Filmlista – projektleírás Claude Code számára

## Kommunikáció
- A felhasználóval (Norbi) **magyarul** kommunikálj.
- Norbi SQL-ben és telefonos rendszerekben (Asterisk) jártas, a JavaScript/Next.js világ új neki.
  Röviden magyarázd el, mit és miért csinálsz, és a terminálparancsokat is írd le.
- Windowson dolgozik, VS Code-ban, a terminál alapprofilja Command Prompt (cmd).

## Mi ez?
Személyes webalkalmazás megnézendő filmek és sorozatok nyilvántartására:
borítókép, műfajok, IMDb link, állapot (megnézendő / folyamatban / megnézve / abbahagyva), letöltve jelző.
Norbi a fő felhasználó; Mama saját, korlátozott fiókkal Norbi filmjeit látja és jelöli. Az adatmodell
felhasználónként elkülönít.

## Technológia
- **Next.js 16** (App Router), **JavaScript** (nem TypeScript), React 19
- **Supabase** (PostgreSQL + Auth + Realtime), `@supabase/supabase-js`, kliensoldali használat
- **Vercel** hosting, a GitHub `main` ág minden push-a után automatikus deploy
  - Repó: `norberttutor/filmlista` (privát)
  - Élő oldal: https://filmlista-six.vercel.app/
- **TMDB API** a film/sorozat adatokhoz (magyar nyelv: `language=hu-HU`)
- Stílus: sima CSS (nincs Tailwind), CSS változókkal; témakörönként az `app/styles/NN-<téma>.css` fájlokban, az
  `app/globals.css` csak `@import`-okkal sorolja fel őket (a fordító egy fájlba fűzi). **A sorrend számít** (azonos
  erősségű szabályok közül a későbbi győz): új fájl a helyére kerüljön a listában, ne a végére.

## Környezeti változók
`.env.local` (helyben) és Vercel → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_KEY` – publishable/anon kulcs (a böngészőbe kerül, RLS véd)
- `TMDB_READ_TOKEN` – TMDB API Read Access Token, **csak szerveroldalon** (route handlerben),
  soha ne kapjon `NEXT_PUBLIC_` előtagot
- `OMDB_API_KEY` – OMDb (IMDb-értékelések, napi 1000 lekérdezés), csak szerveroldalon. Ha hiányzik,
  az app értékelés nélkül működik.
- `APP_VERSION` – nem kell beállítani: a Vercelen a commit (`VERCEL_GIT_COMMIT_SHA`), helyben `dev`.
  Csak a teszt adja meg.

Csak helyben (`.env.local`): `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`, `MAMATEST_USER_EMAIL` /
`MAMATEST_USER_PASSWORD` (Mama-tesztfiók; az értékeket soha ne írd ki), `SUPABASE_DB_URL` (admin) és
`BACKUP_DB_URL` – a csak olvasó `backup_reader` szerep (`munka/e2e/mentes-olvaso.mjs` állítja be);
ugyanez GitHub-titok is (Actions → `BACKUP_DB_URL`) a heti mentéshez.

Soha ne használd a Supabase secret/service_role kulcsot a kliensben.

## Hol mi van
- **`munka/ROADMAP.md`** – a hátralévő feladatok táblázatban, becsült idővel. Kész feladat után frissítsd.
- **`munka/terv-3/TERV.md`** – a „terv-3 NN” pontok: Norbi döntései, az elvetett ötletek oka, látványterv-linkek; az új
  pont terve ide kerül (kész után csak a jövőt érintő döntés marad belőle).
- Az átnézés (K/H/S/I/J kódok) és a kódaudit („#N”) lezárult, az iratuk törölve; egy kód okát a git log commitjai
  mutatják (`git log --grep`).
- A `munka/` mappa helyi (git-ből kizárva), leírása: `munka/README.md`.
- A kész munkák története: git log + TERV.md. **Ebbe a fájlba csak a mostani működés és a szabályok
  kerüljenek**, tömören – történet, dátumok, commit-hashek nem.

## Fájlszerkezet

### Alap
- `app/layout.js` – Bricolage Grotesque (`--font-main`, `axes: ['opsz']`); a téka-témához Bungee (`--font-sign`) és
  VT323 (`--font-osd`), `preload: false` – csak a téma használja, más témában nem töltődnek le; `lang="hu"`, fül: „Megnézendő
  filmek”, `viewport.themeColor` `#1a222d` (világosban a `lib/theme.js` cseréli `#fcf9f4`-re). A `<head>`-ben a
  `THEME_BOOT_SCRIPT` (`lib/themeBoot.js`), ezért a `<html>`-en `suppressHydrationWarning`.
- `app/page.js` – kliensoldali session: belépés vagy lista. A `list_viewers` saját sora alapján néző (Mama) →
  `MamaView`, különben (hibánál is) `Watchlist`; amíg nem tudja: „Betöltés…”. A választ a `localStorage`
  jegyzi (`filmlista-nezo:<userId>`). Net nélkül / lejárt tokennel / ha a `getSession()` nem válaszol (4 mp, net
  nélkül 0,3 mp) a tárolt munkamenettel (`storedSession()`, `offline: true`) nyílik a `Watchlist`. Indításkor
  `registerServiceWorker()`, `startBackClose()`, `initUserTheme(userId, néző)` (`useLayoutEffect`);
  `SIGNED_OUT`-nál `clearSnapshots()` és `forgetThemeUser()`. „Kilépés” (Norbi és Mama): `signOut()` (`lib/offline.js`) – net
  nélkül, lejárt tokennel vagy 5 mp után helyben (a tárolt munkamenet és lista törlése, újratöltés).
- `app/icon.svg` + PNG-változatok (`app/apple-icon.png`, `public/icon-192.png`, `public/icon-512.png`,
  `public/icon-maskable-512.png`) – mind a `munka/e2e/ikon.mjs`-ből; ikonváltozáskor ezzel generáld újra.
- `app/manifest.js` – manifest (telepíthető app, `theme_color` = `--bg-top`). Gyorsindítók: `/?nyit=hozzaadas` |
  `franchise-ok` | `statisztika` – a `Watchlist` a betöltés után egyszer megnyitja (`SHORTCUTS`) és kiveszi a
  paramétert. Ellenőrzés: `munka/e2e/verify-ikon.mjs`.
- `app/error.js` + `app/sorrend/[token]/error.js` → `components/ErrorScreen.js` – magyar hibalap („Újrapróbálás” –
  `retry()` –, „Az oldal újratöltése”).
- `components/LoginForm.js` – e-mail + jelszó (regisztráció nincs, ki van kapcsolva), középre zárva,
  vetítőfénnyel (`main.login::before` / `::after`).
- `components/SiteFooter.js` – kötelező TMDB forrásmegjelölés, ne töröld; „sponsored by ADERTIS”
  (https://www.adertis.hu, új lapon; `span.sponsor`, nem `p` – a teszt egy bekezdést vár a láblécben).

### Téma
- `lib/theme.js` + `lib/themeBoot.js` + `components/ThemeToggle.js` – világos / sötét (terv-3 50). Alap a sötét;
  a világos a `<html data-theme="light">`. Választás felhasználónként (`filmlista-tema:<userId>`); ha nincs:
  Mama (néző) világos, más sötét. Az utoljára használt (`filmlista-tema`) a boot-szkripté (nincs villanás) és a
  belépési oldalé. A megosztott oldal (`/sorrend/…`) a `prefers-color-scheme`-et követi. `setTheme()`,
  `useTheme()`. A `themeBoot.js` React nélküli (a szerverkomponens `layout.js` is használja). Norbinál kerek
  ikongomb (`.theme-toggle`), Mamánál feliratos (`labeled`, `.theme-toggle-labeled`). Teszt: `test-50.mjs`.
- **Videotéka-téma** (D10, `'teka'`, `<html data-theme="teka">`): harmadik, választható téma a sötétre építve; a ⋮
  „Videotéka-téma” / „… kikapcsolása” (→ sötét) kapcsolja, a téma gombja innen világosra visz; Mamánál nincs. **Norbi
  feltétele: a sötét és a világos kinézet nem változhat** – minden téka-szabály `:root[data-theme='teka']`-val kezdődik
  (`app/styles/03-teka-szinek.css` és `35-teka-felulet.css`), a téka elemei csak `useTheme() === 'teka'` mellett
  kerülnek a lapra (`lib/teka.js`: `tekaIsNew` – 7 napon belül „ÚJ!”, `tekaCategory` – az első műfaj, `tekaOsd` – „▶
  LEJÁTSZÁS” / „■ VÉGE” / „⏏ KIADVA”, `tekaStamp`): kártya (`.teka-marks`: kazettatok, kategóriacímke, árcédula,
  videomagnó-felirat; `.teka-new`), adatlap (`.teka-play`, képcsíkok, magnógombok), Statisztika (`.teka-card` – tagsági
  kártya, az 5 legutóbb megnézett). A kártya címe cégtáblabetűvel csak asztalon. Új téka-szabálynál is a prefix kell;
  ellenőrzés: `munka/terv-3/terv-d/osszevet.mjs` (a HEAD és az új fordítás képpontos összevetése sötétben / világosban).
  Teszt: `test-d9-d10.mjs`.

### Fő lista – `components/Watchlist.js`
- **Részei** (`components/list/`; a `Watchlist` csak összeköti őket és a fejlécet, a listát, az ablakokat rajzolja):
  `useListData` (betöltés, tárolt lista, újrapróbálás, helyi mentés, `reloadAfterRestore`; `loadTitles`,
  `loadFranchises`, `byName`), `backgroundRefresh` (`startBackgroundRefresh`, `useMissingLogos`), `useNotificationList`
  (+ `useAppBadge`), `listFilters` (`DEFAULT_FILTERS`, `SEARCH_FILTERS`, `SORTS`, `NO_FRANCHISE`…), `useListFilters`
  (szűrők, keresés, rendezés, `visible`, `kept` – `keepShown`, `releaseFranchise`), `FilterBar` (a szűrősor),
  `SearchNote`, `usePaging` (`PAGE_SIZE`…), `useCollapsingHeader`, `useListView`, `useListChanges` (mentett / felvett /
  törölt sor, „Hogy tetszett?”, franchise-javaslat és -műveletek), `useLiveTitles` (élő szinkron), `moreItems` (⋮
  pontjai, `ONLINE_ONLY`). Az ablakok egy állapotban (`dialog`: 'stats' | 'franchises' | …; `openDialog`).
- **Betöltés**: `titles_with_genres` nézet (`loadTitles()`, `fetchAll`). A háttérfrissítések (`refresh…()`) csak
  akkor hívják a szervert, ha van esedékes cím (`lib/refreshDue.js`). Csendes újratöltés (`reloadKey`, csontváz
  nélkül, a szűrők / lapozás / nyitott adatlap marad): visszatéréskor, lehúzásra, élő szinkron újrakapcsolódásakor.
- **Offline / csak olvasható** (terv-3 44): induláskor azonnal a helyben tárolt lista (`stale`), a friss a
  háttérben („· frissítés…”); minden változás 1,5 mp után helyben is mentődik. `readOnly` (tárolt lista vagy nincs
  net): nincs hozzáadás, az írási menüpontok kimaradnak (`ONLINE_ONLY`), az adatlap mezői tiltva (`Lock` –
  `fieldset.lock`, `display: contents`; fölötte `.readonly-note`), a tiltott vezérlők halványak (`main[data-readonly]`), a háttérfrissítések nem indulnak, és minden írási hely (Hasonló címek,
  gyűjtemény-ablak, nézési sorrend, Franchise-ok, harang, üres állapot) elrejti / tiltja az írást.
  **Új írási gombnál a `readOnly`-t is kezeld** (a „Visszavonás” is). Sikertelen betöltésnél `.offline-note` sáv („Nincs
  internetkapcsolat.” / van netnél „A szerver most nem érhető el.”), újrapróbálás a net
  visszatérésekor és félpercenként; ha a friss lista már látszott, a net visszatértekor csendes újratöltés.
  `main[data-list]`: `loading` | `stale` | `live` (a teszt erre vár).
- **Fejléc** („Megnézendő filmek és sorozatok”, összecsukódó – terv-3 99, J6): `header.top.collapsing` negatív
  `top`-pal ragad (`--head-h` mért magasság); a `--head-p` (0–1) szerint a nagy cím (`.top-title`) összemegy, a kis
  cím (`.top-compact`) előtűnik, összecsukva `data-compact`. Telefonon a `--head-c` (3,6 rem) sáv fent marad;
  asztalon (≥ 641 px) `main[data-head-away]` → `--head-c: 0rem` (a fejléc egészen felgördül; nyitott „Cím
  hozzáadása” panelnél nem). „Kevesebb mozgás” módban nincs közbülső állapot. Teszt: `test-1015.mjs`.
- **Neonfelirat** (D9, `components/NeonBrand.js`): a nagy cím két csőből („Megnézendő filmek” + „és sorozatok”,
  `.neon-line`, `inline-block`), egy sorban, egyforma méretben (Norbi kérése; ha nem fér ki, a „filmek” után törik); a szöveg a kikapcsolt cső, az `::after` (`data-text`) az égő réteg, a `.neon-line::before` a fény a falon (csövenként ovális, a széléig elhalványul);
  munkamenetenként egyszer felvillan (`neon-on`, `sessionStorage` `filmlista-neon`). Színek: `--neon-1` (türkiz) /
  `--neon-2` (lila), `--neon-tube` / `--neon-core` / `--neon-k` (világosban színes üveg, halk fény; tékában rózsaszín /
  sárga); a kis cím (`.top-compact`) is neon. A belépési oldal címe sima. Teszt: `test-d9-d10.mjs`.
- **Fejléc gombjai**: „Cím hozzáadása”, harang, e-mail (`.account-email` gomb → „Jelszó módosítása”; telefonon
  rejtve, net nélkül sima szöveg), Kilépés, téma, ⋮ (`MoreMenu`): Statisztika, Franchise-ok, Színészek és rendezők, Toplisták (net nélkül egyik sem), IMDb import (telefonon
  nincs), Tömeges import és Mentés letöltése (csak asztalon), Videotéka-téma, Mentések, Jelszó módosítása (net nélkül nem),
  Felhasználói leírás, Hibák (N) (csak ha van naplózott hiba; net nélkül nem). Asztalon (≥ 900 px) a sor nem törik. Telefonon (≤ 640 px) lebegő „+” (`.fab`; lefelé
  görgetéskor elhúzódik; nyitott „Cím hozzáadása” panelnél nincs).
- **Szűrősor**: Típus (Filmek / Sorozatok; franchise vagy keresés mellett „Filmek és sorozatok” – `type: 'all'`,
  franchise választásakor magától, megszűnésekor vissza Filmek), állapot (gombok; telefonon lenyíló; „Folyamatban” és
  „Abbahagyva” csak sorozatos típusnál – `MOVIE_HIDDEN_STATUSES`; Filmekre váltva „Mind” lesz belőle), Letöltés, Műfaj (az adott típus műfajai, ikonos lenyíló), Mama (csak ha van
  Mama-jelölés; Sorozatok típusnál / franchise-ra szűrve nem látszik és nem szűr – `mamaFilter`), Franchise, ↺.
  **Alapállapot** (`DEFAULT_FILTERS`, Norbi kérése): Filmek – Megnézendő – Nem letöltött – Összes műfaj – Franchise
  nélkül. Az állapotgombok darabszámai a többi szűrőt figyelembe veszik.
- **Asztalon (≥ 641 px, M3)**: az állapot „Mind” gombja külön (`.status-all`, `.status-sep`), az állapotok közös
  sávban (`.status-track`, csúszó kijelölő) ikonnal (`components/FilterIcons.js`) és darabszám-pirulával; a Letöltés
  gombcsoport (`.download-seg`, „Mind” / „Letöltött” / „Nem letöltött”); a Típus, a Mama és a Rendezés is
  `FranchiseFilter` (`rootClass="filter-select"`, `.type-filter` / `.mama-filter` / `.sort-filter`); a Műfaj, a Mama
  és a Franchise gombján belső címke, a nem alapértelmezett érték halvány türkiz (`changed`); a panel üveges,
  darabszámokkal (`facetCounts` – a többi szűrővel), a műfajpanel rácsos (`layout="grid"`, a 0 darabos halvány).
  2560 px-en egy sor (mérve, Mamával). **Telefonon a régi**: beépített `<select>`-ek (`isPhone`), külső felirat.
  Teszt: `test-m3.mjs`.
- **Telefonon** a szűrők összecsukva: „Szűrők” gomb + a beállított szűrők címkeként ×-szel (`activeFilters`,
  `.active-filters`; a típuson nincs ×; „↺ Alaphelyzet”; a széle arra halványul, amerre görgethető – `lib/useScrollFade.js`), kinyitva összefoglaló (`filterSummary`), legfeljebb a
  képernyő 70%-a. A kereső összecsukva is látszik.
- **Keresés a listán**: cím, eredeti cím, franchise neve; ékezet- és kisbetű-független (`fold()` – közös, a `lib/listSearch.js`-ből), több szónál mind.
  Elírás-tűrés és kiemelés (terv-3 66): `lib/listSearch.js` (`resolveWords`, Damerau–Levenshtein ≤ 1, 5+ betűs
  szónál), `components/Highlight.js` (`mark.hl`, `<Hl>`, `SearchHighlight` kontextus), `.search-note`. Gépeléskor a
  szűrők félreállnak (`SEARCH_FILTERS`), törléskor visszaállnak. Teszt: `test-1013.mjs`.
- **Rendezés** (`SORTS`): legutóbb / legkorábban hozzáadott, legjobb értékelés, legújabb / legrégebbi megjelenés
  (`releaseKey(t)` – pontos dátum, üres a végére). Franchise-ra szűrve: ha van nézési sorrendje, „Nézési sorrend”
  (`WATCH_ORDER`, magától – `orderSort`), különben „Legrégebbi megjelenés” (`FRANCHISE_SORT`); az állapot ilyenkor
  „Mind” (`statusBeforeFranchise` – megszűnéskor vissza, kézi választás után nem); kézi rendezés után az marad.
  Nézési sorrendnél a lista tételekből áll (`visible`: `{ key, title, item }`; a sorozat évadonként külön tétel –
  `.card-season`, `.season-tag`); a szűrők, a darabszámok és a `kept` tételenként.
- **Nézetek**: ≥ 1400 px-en lista (`TitleTable`) | rács váltó (`localStorage` `filmlista-nezet`, alapból lista),
  alatta mindig rács. Váltáskor a borítók a helyükre siklanak (`lib/viewSwitch.js`, `data-flip` kulcsok). Rács:
  telefonon 3 oszlop, asztalon `minmax(185px)`.
- **`kept`**: a most szerkesztett, már látható sor a szűrés változásáig a helyén marad, akkor is, ha már nem illik
  a szűrőbe (így visszavehető); a szűrőbe nem illő, épp felvett cím nem kerül be.
- **Üres állapot** (`EmptyState`): keresésnél „Keresés a TMDB-n: „…”” (`openAdd(q)`, `TitleSearch initialQuery`) +
  „Keresés törlése”; szűrésnél „Szűrők törlése” + „Felfedezés”; üres listánál „Első cím hozzáadása” + Tömeges import
  (a nevek szándékosan nem ütköznek a fejléc „Cím hozzáadása” gombjával).
- Franchise-ra szűrve a lista fölött a `FranchiseCollection` sáv.
- **Törlés visszavonással** (`requestDelete(t)`): azonnal lekerül, 8 mp-ig „Visszavonás”; az adatbázisból csak
  lejáratkor / ×-re törlődik (ha a lapot közben bezárják, megmarad).
- **„Hogy tetszett?”**: a táblázatból Megnézve-re váltott, értékelés nélküli címnél (`handleRowUpdated` →
  `askRating`; csak a mentett sorra – `askAfterSave` –, egyszer; a szerkesztő ablakból nem).
- **Lapozás** (`components/Pagination.js`): 25 (`PAGE_SIZE` – telefon, keskeny rács), 10 (`TABLE_PAGE_SIZE` –
  asztali lista), 22 (`GRID_PAGE_SIZE` – asztali rács). Asztalon (≥ 1400 px) a lapozó és a lábléc egy sávban alul
  (`docked` → `.pagination.docked`, `main[data-docked]` – lapozó nélkül is; `--docked-footer-h`, `--pager-w`,
  `--sponsor-w`; a `main` flex oszlop, `flex: 1`). A lapozás az oldal első címét jegyzi (`pageState.first`, így
  nézetváltáskor ugyanaz a cím látszik); szűrés / rendezés / keresés váltásakor 1. oldal; lapozáskor a
  `.filters-anchor`-hoz görget. Telefonon tömör (`.pg-step`, a `.pg-word` rejtve).
- **Letapadt szűrősor** (`position: sticky`, `top: var(--head-c)`, `data-stuck`): átlátszó, mögötte fokozatos
  elmosás (`components/ProgressiveBlur.js`, terv-3 102 – öt `backdrop-filter` réteg). **A sáv és az ősei nem
  kaphatnak `backdrop-filter`-t, `filter`-t, `opacity`-t, maszkot** – különben a rétegek nem látnak át. A
  `--filters-h` (ResizeObserver) a táblázat ragadós fejlécéé. Asztalon gyorsgombok (`.stuck-tools`): „↑”, kerek „+”
  (nyitott „Cím hozzáadása” panelnél nem), harang (`NotificationBell quiet`), ⋮ (`moreItems`). A helyük nyugalomban
  is foglalt (`data-off` → `visibility: hidden`), hogy letapadáskor a sor ne törjön másként – ezért asztalon
  keskenyebb a kereső (10,5 rem) és kisebb a csoportköz (1,5 rem). A kerek gombszabályok csak `> button`-re. A
  fejléc felugrói a szűrősor (`z-index: 30`) fölött. Teszt: `test-102-103.mjs`.
- **Csúszó kijelölő** (`lib/useSlidingThumb.js`, terv-3 100): új gombcsoportnál `className="… sliding"` +
  `ref={useSlidingThumb()}`; a kiválasztott közvetlen gyermek `aria-pressed` / `aria-selected`.
- **„Folyékony üveg”** (terv-3 103): a lebegő gombok (`.stuck-tools`, `.fab`, `.backdrop-pager`) – `--lg-fill`,
  `--glint`.
- Az `<Toaster />` a `main` végén.

### A lista elemei
- `components/PosterCard.js` – kártya: borító (w342), állapotcsík, „Letöltve” jelvény; a borító és a ceruza a
  szerkesztőt nyitja, a cím (legfeljebb 3 sor, `title`-ben a teljes) az IMDb- (vagy TMDB-) adatlapra visz; „Hozzáadva: <dátum>”, `StarsDisplay`,
  `GenreList`; Mama „Érdekli”-nél borostyán „M” (`.poster-corner > .mama-mark`; a többi Mama-érték a kártyán nem
  látszik). Rámutatva hangulatszín (`usePosterColor`). Meg nem jelent filmnél (`releaseState`, `data-release`)
  szaggatott keret + `ReleaseBadge`. Évados sorozatnál évadcsík + „x/y évad”; a legkorábbi bejelentett évad
  (`nextSeason(t)`, abbahagyottnál nincs, megnézettnél van) a borító alján `ReleaseBadge` (`kind: 'season'`, tévé-ikon,
  „3. évad · dec. 8.”; telefonon rövid – `.release-short`: idén a nap, más évben az év), keret nélkül. Teszt: `test-84.mjs`.
- `components/TitleTable.js` – asztali lista (≥ 1400 px, `DESKTOP_QUERY`; `table-layout: fixed`): kártyaszerű
  sorok, legfeljebb 1720 px, 100 px-es borító (w185; gomb → szerkesztő); a cím legfeljebb 2 sorban, az eredeti cím 1
  sorban „…”-val (`title` a teljessel), a leírás 2 sorban; a sor halványan a film színében, a jelenetkép
  (`--row-img`, `tr[data-img]`) a címcella jobb felén. A Franchise lenyíló a „Hozzáadva” sor végén (`.row-added`,
  `--franchise-col` 11 rem; üresen láthatatlan, de helyet foglal – rámutatáskor nem ugrik). Oszlopok: Letöltve –
  Állapot – Mama (9,75 rem; sorozatnál / franchise-os címnél üres – `mamaApplies`) – Értékelés (10 csillag + „8/10”)
  – kuka (megerősítés nélkül, visszavonható). Az üres lenyílók és a kuka csak rámutatva (`@media (hover: hover)`).
  Mentés: `saveRow`. Évados sorozatnál `SeasonDownloads` / `SeasonCell` (alatta a bejelentett évad indigó sorban –
  `.season-next`; a soron nincs évad-jelvény). Megjegyzés mező nincs (a `notes` oszlop
  megmaradt). Animált átrendeződés: `Reflow` (`reflowKey`).
- `components/Seasons.js` – évadok: `hasSeasons`, `seasonCounts`, `seasonRange` („1–3., 5.”), `useSeasonActions`
  (`saveRow`; megnézettre állításkor az előtte lévő üres évadok is, 10 mp „Visszavonás”), `SeasonStrip` (táblázatban
  kattintva léptet: üres → Folyamatban → Megnézve; a bejelentett szaggatott, nem jelölhető), `SeasonList` („Mind
  megnézve”, „Nem nézem tovább” / „Mégis folytatom”, „+ Évad hozzáadása”, „Utolsó évad törlése” megerősítéssel – a
  TMDB-n is szereplőt a heti frissítés visszahozza), `SeasonTimeline` (≥ 2 évad; a tengely a mát mindig
  tartalmazza), `SeasonCell`, `SeasonDownloads`. „Abbahagyva”: kézi, az évadjelölés és az új évad sem írja felül; a
  „Mind megnézve” feloldja. Epizódszintű követés nem kell.
- `components/ReleaseBadge.js` – „Hamarosan · okt. 15.” (indigó) / „Moziban · digitálisan: …” (korall) / „3. évad ·
  dec. 8.” (`season`, indigó, `SeasonIcon`), `data-kind`; telefonon rövid. Szűrőgomb nem kell (Norbi döntése).
- `components/GenreList.js` + `lib/genreColors.js` – műfajok színes pöttyel (`genreColor(név)`, OKLCH, a kulcs a
  TMDB magyar műfajneve, ismeretlen szürke), felolvasónak vesszővel; megnézettnél szürke.
  `components/GenreIcon.js` – műfajikonok (terv-3 56; `--g` = a műfaj színe).
- `components/FranchiseSelect.js` – franchise lenyíló: meglévők / „+ Új franchise…” / törlés / átnevezés helyben
  (Enter / Esc, ütközésnél hibaüzenet; `.franchise-new` módban az adatlap nem zár kikattintásra).
- `components/FranchiseFilter.js` – franchise-szűrő saját listbox-a logókkal (`FranchiseLogo`: a sötét logót
  fehérre színezi – `.dark`; világos felületen sötét sziluett); csoportok „Van még megnézendő” (`N hátra`) / „Mind
  megnézve” (`li.franchise-group`, `role="presentation"`); felolvasónak „Név, 2 hátra” (a teszt `frOption()`-ja erre
  épít). `lead="icon"` + `className="genre-filter"`: a műfajszűrő is ez. Asztalon a szűrősor többi lenyílója is (M3):
  `label` (belső címke), `ariaLabel` (felirat nélkül), `changed`, `icon` (alapikon), `layout="grid"`, `rootClass`,
  `o.count`; ha a panel jobbra kilógna, `--shift`-tel balra tolódik. A `.grid` osztálynév foglalt (borítórács) –
  a rácsos panelé `.ff-grid`.
- `components/StarRating.js` – `StarRating` (rádiógombok; kattintás azonnal ment, billentyűzettel a nyíl / Home /
  End csak előnézet, az Enter / Szóköz ment; a kiválasztottra újra kattintva `null`; `.pop` animáció csak
  választáskor) és `StarsDisplay`.
- `components/Reflow.js` – animált átrendeződés szűréskor / rendezéskor (terv-3 49.3): saját FLIP
  (osztálykomponens, `getSnapshotBeforeUpdate`), **nem View Transitions** (az a letapadt szűrősor fölé rajzolna, és
  közben a lap nem kattintható). `data-flip="<kulcs>"`; a `.grid` / `.table-wrap` ezért `position: relative`; a
  „kevesebb mozgás”-t maga nézi. Teszt: `test-49-3.mjs`.
- `components/ListSkeleton.js` (csontváz), `components/EmptyState.js`, `components/ImdbBadge.js`.
- `components/Toaster.js` + `lib/toast.js` – értesítősáv: `toast({ text, image, content, action: { label, onClick
  }, hideClose, duration = 8000, onExpire, kind })` → id; `dismissToast(id, how)`; az `onExpire` lejáratkor és ×-re
  fut (az action-re nem); legfeljebb 3 (a legrégebbi lejáró szorul ki, a `duration: null` soha); rámutatva megáll; `duration: null` – nem jár le; `kind`: 'delete' (piros) |
  'rating' (borostyán); kilépéskor `clearToasts()`. **Nyitott `<dialog>` fölött a sáv nem kattintható** – ablakon
  belül helyi visszajelzés kell.

### Adatlap – `components/TitleEditor.js`
- Natív `<dialog>`, **lapokat tart** (`stack`: `{ id, rowId, item, added }` vagy `{ id, person }`): mindig az
  utolsó látszik, a többi rejtve megmarad a görgetésével (`.editor-page[hidden]`). A lap sora a `titles` propból jön
  (`rowId`, különben TMDB-azonosító); ha nincs a listán: **előnézet** (`TitlePage preview`, `/api/tmdb/details`):
  „Hozzáadás a listához” (`addTitle(item, details)`), „Már láttam”, „Bezárás”; felvétel után helyben rendes
  adatlap (`.added-note`), nem zárul be. Előnézet a keresőből, a Felfedezésből, a Hasonló címekből, a harangból;
  a franchise-gyűjteményből és az importokból nem. Új lapnál „‹ Vissza: …” (`.back-link`); a Szereplők nevéről
  `PersonPage`.
- Az elöl lévő lap `apiRef`-en adja a `canLeave`-et (törlés-megerősítés, franchise-név gépelése, felvétel közben
  nem hagyható el). A cím `id="editor-title"`-je csak a látható lapé; megnyitáskor a fókusz a címen (keret nélkül),
  nem a Franchise mezőn. A rejtett lapon nem szól az előzetes.
- **Azonnali mentés** (terv-3 79): minden mező kattintásra ment (`save()` → `saveRow`, optimista), nincs Mentés /
  Mégse. `SavedCheck` pipa 2 mp-ig, `.saved-note` („… – mentve · Visszavonás”, lépésenként – `undos`, 10 mp).
  Franchise létrehozása / törlése után a `created` / `deleted` ref (a törölt franchise üresre állítása nem mentendő).
- Mezők: Franchise + Saját értékelés (`.editor-pair`; 900 px alatt egymás alatt), vezérlősáv (`.editor-controls`):
  Állapot | Letöltve | Mama (Mama csak `mamaApplies` esetén); évados sorozatnál az állapot helyett `SeasonList`. A
  `watched_at` nem látszik (megnézettre állításkor a mai nap). „Abbahagyva” csak sorozatnál. Műfajok sima szövegként,
  pötty nélkül (`.editor-genres`, a `.editor-titletext`-ben).
- Alul ikonos ghost gombok: „Törlés a listáról” (`.danger-ghost`, megerősítéssel, utána `onDelete` →
  `requestDelete`) és „Frissítés a TMDB-ről” (`.tmdb-refresh`, `refreshTitleDetails(id)`).
- Részei: előzetes (`/api/tmdb/videos`; `components/Trailer.js` – `TrailerButton`, `TrailerPlayer`, Mamáé is;
  `youtube-nocookie.com`, `.trailer`), `WatchProviders`, `TopCast`,
  `TitleGallery`, `SimilarTitles`, `SeasonTimeline`.
- **Elrendezés**: asztalon (≥ 900 px) 66 rem széles, két oszlop (bal: nagy borító w500, „Hol nézhető?”, szereplők –
  `.editor-side`). Jelenetképes lapon asztalon **moziszerű fejléc** (terv-3 104, `WIDE_QUERY`, `.editor-page.has-hero`):
  a `header` a képre kerül (kisebb borító, nagy cím, adatok, 3 soros leírás „Tovább”-bal – ResizeObserver méri;
  kinyitva a kép, a cím és a kis borító a helyén marad – `data-frozen`, `--hero-img-h` / `-head-top` /
  `-poster-top` –, a szöveg alatta folytatódik, előzetes); nagy borító ilyenkor nincs. Ha a jelenetkép később jön, a fejléc áthelyeződik, a fókusz visszakerül a
  címre. 900 px alatt egy oszlop, a borító kicsiben a jelenetkép aljára úszik (`.editor-titlebar` >
  `.editor-hero-poster` + `.editor-titletext`; asztalon `display: contents`). Teszt: `test-104.mjs`.
- Telefonon (≤ 640 px) alsó lap: fogantyú (`.sheet-handle`, lehúzva zár – `lib/useSheetDrag.js`, Mamáé is), nincs ×
  és „Bezárás”.
- **Bezárás**: ragadós × (`.editor-close-bar`), Esc, kikattintás asztalon (`useBackdropClose`), Vissza gomb
  (`backHandler`). `closedby="none"` (Android – lásd `lib/backClose.js`).
- **Nézetváltás** asztalon (`lib/viewTransition.js`): a kattintott borító átsiklik az adatlapra (`openEditor(t,
  forrásElem)`), bezáráskor vissza (törléskor nem); ezért a `showModal()` `useLayoutEffect`-ben fut. Csak az első
  lapról siklik vissza.
- Hangulatszín (`usePosterColor` + `ambientProps`): az ablak a film színében dereng – az ablak saját háttere, nem
  `::before` réteg (az görgetéskor felgördült).

### Az adatlap részei
- `components/TopCast.js` + `/api/tmdb/credits` – szereplők (`pickCast`, legfeljebb 20 – `CAST_MAX`) és filmnél a
  rendező(k) (`pickDirectors`, ≤ 3; a kérés `v` paramétere `CREDITS_V` – `lib/titles.js`, a `lib/prefetch.js` is); az első 3, „Összes
  szereplő (N)” (telefonon nincs), alattuk „Rendező” (keskenyebben „Rendező: …” sor). A név (asztalon a fotó is) a
  személy lapját nyitja (`onPerson`; rendezőnél `role: 'director'`).
- `components/PersonPage.js` + `/api/tmdb/person` (`?role=director`, a kliens `v=2` – `PERSON_V`; közös forrás:
  `lib/server/people.js` `loadPerson`) – a színész / rendező lapja (terv-3 61, M4): adatok, „Követem”
  (`FollowButton`), „A listádon (N)” rács, „További filmjei és sorozatai (N)” (ismertség szerint, 10 +
  „Továbbiak mutatása”; kimarad a `minor`: borító nélküli, animáció / dokumentum / talkshow / hírek / valóságshow /
  szappanopera, ≤ 2 részes sorozatszerep, önmaga-szerep – a listán lévő akkor is látszik). Alapból csak a
  főszerepek (`lead`: filmben a stáblista első 3 helye, sorozatban ≥ 6 rész; rendezőnél mind), „Főszerepek | Összes
  szerep” (`RoleSwitch`; rendezőnél nincs). „+ Hozzáadás” / „Már láttam” (`CreditStatus`, `useAddCredit` – az
  idővonal is). Teszt: `test-61.mjs`, `test-m4.mjs`.
- `components/TitleGallery.js` + `/api/tmdb/images` – képgaléria (terv-3 95): asztalon `GalleryStrip`, telefonon
  `BackdropPager`, nagy nézet `GalleryLightbox` (az Esc a window rögzítő fázisában és a Vissza csak ezt zárja).
  Sötét sziget mindkét témában. Teszt: `test-95.mjs`.
- `components/WatchProviders.js` + `/api/tmdb/providers` – „Hol nézhető?”: magyarországi `flatrate` + `free` +
  `ads`; kölcsönzés / vásárlás nincs; ha nincs szolgáltató, semmi; a logók nem kattinthatók; alatta kötelező
  „Forrás: JustWatch” (TMDB-feltétel).
- `components/SimilarTitles.js` + `/api/tmdb/similar` – „Hasonló címek” (alapból nyitva, a csukást
  `filmlista-hasonlok` jegyzi; telefonon mindig csukva indul és nem jegyzi); „+ Hozzáadás”, „✓ A listán”, ×.

### Felfedezés, kereső
- `components/TitleSearch.js` – „Cím hozzáadása” panel: 400 ms késleltetett TMDB-keresés, „Hozzáadás a listához” +
  halk „Már láttam” (megnézettként, utána „Hogy tetszett?”), „✓ A listán”; `initialQuery`; a borító / cím
  előnézetet nyit (`onPreview`); üres keresőnél `Discover`. Színészek és rendezők is (terv-3 110, `.people-results`,
  ≤ 6, csak Acting / Directing): kattintásra `openEditor({ person })` – a `TitleEditor` első lapja a `PersonPage`; ha
  a TMDB a személyt tette elsőnek (`peopleFirst`), a címek előtt, különben utánuk. A mező felirata „Film vagy sorozat
  címe – vagy színész, rendező” (az eleje a tesztek kapaszkodója). Teszt: `test-110-111.mjs`.
- `components/Discover.js` + `/api/tmdb/discover` + `lib/server/discover.js` (`discoverList`, `DISCOVER_LISTS`) –
  sorok: „Most a mozikban”, „Hamarosan a mozikban”, „Új digitálisan”, „Népszerű sorozatok”, „Neked ajánlott”;
  soronként saját szín (`section[data-list]`). **Norbit csak a magyar szinkronos címek érdeklik** – közelítés: film =
  magyarországi megjelenés (`region=HU`, `with_release_type` 2|3 vagy 4), sorozat = magyar előfizetéses streaming
  (`watch_region=HU`, `flatrate`, 90 napon belüli rész); angol vagy magyar eredeti nyelv, van magyar leírás; nincs
  dokumentum / valóságshow / talkshow / hírek / szappanopera / **animáció** (`ANIMATION_GENRE` = 16). A szerver
  listánként ≤ 30 jelöltet ad (egy óráig gyorsítótárazva; a kliens `v=2` – `DISCOVER_V`, a válasz változásakor
  emeld); a böngésző a **megnyitáskor már listán lévőket** (`onListAtOpen`, M2) és az elrejtetteket kihagyja, és
  16-ot mutat; a most felvett „✓ A listán”-nal a helyén marad. A Hasonló címek és a kereső nem szűr így. Teszt:
  `test-m2.mjs`. A `.discover` oszlopa `minmax(0, 1fr)` (különben telefonon az egész lap
  kicsinyedik). A borítók rámutatási kerete csak `@media (hover: hover)` alatt. „Nem érdekel” (×) és „Elrejtett
  ajánlások (N)”.
- `components/FeaturedBand.js` + `/api/tmdb/featured` – kiemelt sáv (terv-3 46): a „Most a mozikban” első 6 nem
  elrejtett, nem listán lévő, háttérképes címe (a route 20 jelöltet ad), jelenetkép, logó (`pickLogo`), „Adatlap” / „+ Hozzáadás”,
  ×; magától nem lapoz; a lenti sorból a kiemeltek kimaradnak; hibánál a sáv elmarad.
- „Neked ajánlott” (terv-3 37): a 8+ saját értékelésűek legjobb 10-e (`recommendSeeds`) `/api/tmdb/similar`
  ajánlásai, gyakoriság szerint, ≤ 16; a magyar megjelenést itt nem szűri.
- `lib/hiddenSuggestions.js` + `components/HideSuggestion.js` – „Nem érdekel” (terv-3 39): `useHiddenSuggestions`,
  `loadHidden` (betöltéskor, visszaállítás után), `resetHidden` (kilépéskor), `hideSuggestion` / `unhideSuggestion`
  (optimista), `HideButton`, `HideNote` + `useHideSuggestion` (helyi visszavonás). A Felfedezés és a Hasonló címek
  szűri, a keresés nem.

### Franchise-ok
- `components/FranchisesDialog.js` – a ⋮ „Franchise-ok” ablaka: csempék ábécérendben, **névelő nélkül** („A” / „Az”
  / „The” nem számít); logó, név, mérő, „x/y megnézve · m hiányzik” (y = a listán lévők); hangulatszín
  (`FranchiseTile`, `franchisePosterPath`); a hiányzók a TMDB-gyűjteményekből 3-asával (`paramsKey` szerint
  megjegyezve). Csempére kattintva `CollectionDialog` az ablakon belül (a még be nem töltött soron kívül –
  `openFranchise`, `rushed`, „· megnyitás…”; teszt: `test-h9.mjs`). Csempénként `FranchiseActions` (`compact`).
  Kereső, „+ Új franchise”, fölül `FranchiseSuggestions`. A külső `onClose` csak a saját eseményére zár. Szerkesztés /
  új név / megerősítés közben az Esc és a Vissza (`onCancel`) csak azt zárja (a gyűjtemény-ablak fejlécénél is). TMDB-hibánál
  nem „nincs TMDB-gyűjtemény”: a csempén „a TMDB nem válaszolt” (kattintásra újra), a sávon és a gyűjtemény-ablakban
  „Újrapróbálás” (`loadFailed` / `onRetry`). A törölt franchise nyitott gyűjtemény-ablaka bezárul.
- `components/FranchiseSuggestions.js` + `lib/franchiseSuggest.js` – franchise-javaslat (terv-3 35): **csak
  felajánlja**, magától soha nem rendel hozzá, a meglévőt nem írja át. `collectionFranchiseMap()` (több jelöltnél:
  kézi, több film, név), `suggestedFranchiseId`, `franchiseSuggestions`, `article()` („a” / „az”). Felvétel után
  (`handleAdded`) 1,2 mp-cel sáv; nyitott `<dialog>` alatt a bezárásáig vár. „Nem kell” → `franchise_suggestion_off`.
- `components/FranchiseCollection.js` + `/api/tmdb/collection` + `/api/tmdb/collection-search` – a franchise-sáv
  a lista fölött (háttérkép – `franchiseBackdrop()`, franchise-szín, zöld mérő: megnézett / listán) és a
  `CollectionDialog`: gyűjteményenként szakasz (a franchise összes – ≤ 60 – filmjének `belongs_to_collection`-je + a
  kézzel hozzárendeltek), a részek megjelenés szerint; hiányzó „+ Hozzáadás” (`addTitle` a franchise-szal), a
  listán lévő, de nem ide rendelt rész „+ Hozzárendelés” / „Áthelyezés ide” (`listed` vs `own`); „A franchise-od
  további címei”; „+ TMDB-gyűjtemény hozzáadása” (üresen „Javasolt gyűjtemények” – `suggestQueries()`, a „: Part
  Two”-féle végződés levágva). A számokban csak a franchise címei (`countsNote()`). Két fül: Gyűjtemény / Nézési
  sorrend (`role="tablist"`). Fejlécben `FranchiseActions` + „Logó”. Felvételkor az ablak nyitva marad, a korábbi
  gyűjteményekkel (fül, görgetés, kereső megmarad). Közös exportok: `collectionParams`, `paramsKey`,
  `fetchCollections`, `summarizeCollection`, `CollectionMeter`. Teszt: `test-hozzarendeles.mjs`, `test-audit-6.mjs`.
- `components/FranchiseActions.js` + `/api/tmdb/logos` – ikonos gombok (Szűrés erre, Átnevezés, Logó, Törlés –
  `.danger-ghost`) és `FranchiseLogoPicker` (J8): a franchise címeinek TMDB-logói + „Csak a név” (`logo_path: ''`);
  azonnal ment (`setFranchiseLogo`). Mentés közben a gombok nem tiltódnak (a fókusz a body-ra esne, és az Esc az
  egész ablakot zárná). Net nélkül nincs „Logó”. Teszt: `test-j8.mjs`.
- `/api/franchises/logos` – a `logo_path is null` franchise-ok automatikus logója (`pickLogo()`, ≤ 6:1, angol); a
  kézzel választottat (`''`-t is) nem írja felül; logó híján 7 napig nem próbálja. A `useMissingLogos`
  (`components/list/backgroundRefresh.js`) hívja, franchise-onként munkamenetenként egyszer (`logoTried`).
- `components/WatchOrder.js` + `lib/watchOrder.js` – nézési sorrend (terv-3 28): a franchise listán lévő filmjei és
  a sorozatok évadjai külön tételként (`franchiseItems()`; kulcs `címId:évad`, 0 = film). `orderedItems()`: a tárolt
  sorrend, az újak a végére megjelenés szerint. A megnézett kihúzva a helyén marad, „Következik” (`nextItem()`);
  abbahagyott sorozat évadja kihagyva. Pipa: filmnél `updateTitle(status)`, évadnál `setSeasonStatus`; utána helyben
  „Hogy tetszett?”. Szerkesztés: húzás (pointer-események az ablakon, `touch-action: none`) és ↑ / ↓; „Kész” →
  `set_franchise_order` RPC; „Megjelenés szerint” → `clearOrder`; Esc csak a szerkesztést zárja. `loadOrders()`,
  `franchisesWithOrder()`, `itemLabel()`, `itemMeta()` (a megosztott oldal is).
- `components/ShareOrder.js` + `lib/shares.js` + `app/sorrend/[token]/` – megosztható nézési sorrend (terv-3 41):
  franchise-onként egy link (`loadShare` / `createShare` / `revokeShare`, `shareUrl(token)`). A nyilvános oldal
  szerverkomponens (`connection()`, nem indexelt) a `shared_watch_order()`-ből, ugyanazzal az `orderedItems()`-szel;
  állapot, értékelés, letöltve, Mama nem látszik. Hibás / visszavont link: 404 (`not-found.js`). A service worker nem
  kezeli. `components/ShareAmbient.js`: a franchise színe. Teszt: `test-41.mjs`, `test-20.mjs`.

### Kedvenc színészeim / alkotóim (M4)
- `lib/people.js` – közös tároló (mint a `hiddenSuggestions`): `useFollowed()` (`followKey(id, role)` → sor),
  `loadFollowed` (a `Watchlist` betöltéskor), `resetFollowed` (kilépéskor), `followPerson` / `unfollowPerson`
  (optimista; követéskor rögtön `refreshPeople` – az első ellenőrzés csak megjegyez), `refreshPeople` (a
  `/api/people/refresh`, ha van esedékes – `personDue`; egyszerre egy futás), `personSummary(credits, sorok, ma,
  összes?)` → `{ shown, onList, watched, more, soon }` (a listán lévők mindig; `more`: nem listás, megjelent
  főszerep; `soon`: a legközelebbi dátummal bejelentett), `PERSON_V`.
- `components/PeopleDialog.js` – ⋮ „Színészek és rendezők” (Norbi választása: asztalon portrérács – álló fotó,
  telefonon vízszintes csempék – kerek fotó; csak a CSS más): két fül – „Színészek N | Rendezők M” (`dialog-tabs`,
  csúszó kijelölő; keresésnél, ha a választott fülön nincs találat, a másik látszik) –, ábécérendben, kereső; csempénként mérő,
  „x/y megnézve · m további főszerep / film”, indigó bejelentett film; a számok a `/api/tmdb/person`-ből 3-asával.
  Csempére kattintva az ablakon belül az idővonal (`PersonTimeline`): „Hamarosan” fölül (indigó szaggatott), utána
  évenként a legújabb elöl, „Főszerepek | Összes szerep”, 20 + „Továbbiak mutatása”; a borító az adatlapot nyitja az
  ablak fölött (`onPreview` → `openEditor`). Az Esc / Vissza az idővonalról a csempékhez lép. Net nélkül a menüpont
  nincs (`ONLINE_ONLY`). A harang `person_new` eleme: a borító sarkán a személy fotója. Teszt: `test-m4.mjs`.
- `components/FollowSuggestions.js` + `/api/people/suggest` – „Kit érdemes követned?” (terv-3 111) a Színészek és
  rendezők ablak tetején (keresés közben nincs): a 8+ értékelésűek legjobb 40-e (`suggestSeeds`, `?ids=movie:1,…`) stábja
  – a stáblista első 5 helye, filmnél a rendező (`lib/server/credits.js` `loadCredits`, közös a `credits` route-tal) –,
  legalább 2 címben; a nem követett, nem elrejtett első 6. „Követem” → `followPerson`; × → `localStorage`
  (`filmlista-kovetes-rejtett:<userId>`); a név a személy lapját nyitja az ablak fölött (`onPerson`). Hibánál a sáv
  elmarad. A kliens `SUGGEST_V` – **a válasz változásakor emeld**.

### Toplisták (terv-3 120)
- `components/ToplistsDialog.js` + `/api/tmdb/toplist` + `lib/server/toplists.js` (`loadToplist`) – ⋮ „Toplisták”:
  rangsor soronként (helyezés, borító, cím, IMDb + szavazatszám, műfajok; `.toplist-row`, `li[value]`; minden osztálya
  `toplist-` előtagú – a `.top-*` a fejlécé, a `.tl-*` az évad-idővonalé, mindkettő ütközött már). Fülek: Filmek |
  Sorozatok, Minden idők legjobbjai | Az elmúlt 5 év legjobbjai | Rejtett gyöngyszemek (telefonon rövid nevek); az
  utolsó választás `localStorage` `filmlista-toplista`. Szűrők: Műfaj, Évtized (az 5 évesnél nincs) – a helyezés a
  szűrés után 1-től –, „A listámon lévők elrejtése” (a bekapcsoláskor listán lévők; nem számoz át). Legfeljebb 100
  (`TOP`), 25-ösével. `CreditStatus` / `useAddCredit` (a `PersonPage`-ből): „+ Hozzáadás” / „Már láttam” vagy „✓ A
  listán” / „✓ Megnézve” + saját csillag; a borító és a cím előnézetet nyit. Téka: „★ A hét slágerei ★”
  (`.teka-chart`), zöld kijelzős helyezés, dobogó (1–3.), árcédulás IMDb, kazettatok. Kliens `TOPLIST_V` – **a válasz
  változásakor emeld**. Teszt: `test-120.mjs`.
- A szerver: jelöltek a TMDB-ről (`plan()`: top_rated / discover), a **magyar megjelenés közelítése** (Norbi döntése,
  „laza” szabály – `huOk()`): film – angol / magyar eredetinél HU megjelenés vagy bármilyen HU szolgáltató, más
  nyelvűnél csak HU megjelenés; sorozat – HU streaming; magyar leírás kell; dokumentum / hírek / valóságshow /
  szappanopera / talkshow és koncertfilm (csak „Zene”) nincs, **az animáció benne van**. A TMDB-előrangsor legjobb
  160-ának (gyöngyszemnél 100) IMDb-értékelése: az `imdb_ratings`-ból (30 nap), a saját lista soraiból, végül az
  OMDb-ről – a toplisták napi kerete 400 (`DAILY_OMDB`, `imdb_ratings_today()`). Sorrend: súlyozott IMDb-érték
  (mint az IMDb Top 250; `m` listánként), legfeljebb 250 tárolva (`toplists`, 7 napig; hiányos lista – elfogyott a
  keret – másnap újraépül, a régi addig marad). Gyöngyszem: IMDb ≥ 7,5, 5–150 ezer szavazat. Az első összeállítás
  10–30 mp (`maxDuration = 60`; az ablak 2,5 mp után szól).

### Egyéb ablakok és menük
- `components/MoreMenu.js` – ⋮ menü (`role="menu"`): pontok `{ id, label, description, icon, onSelect }`; nyilak,
  Home / End, Esc; választás után a fókusz a gombra. Ha nem fér ki a gomb alatt, a képernyő aljáig ér és görgethető.
- `components/NotificationBell.js` + `lib/notifications.js` – harang: olvasatlanok száma (borostyán), a legutóbbi
  30, fajtánként színnel (`data-kind`), csoportcímek „Ma” / „Ezen a héten” / „Korábban” (`dayGroup`, budapesti idő).
  Kinyitáskor a betöltöttek olvasottak (`markNotificationsRead(ids)` – csak azonosító szerint; `readIds`). Törlés: ×
  és „Összes törlése” (`removeNotifications`, visszavonható; `dismissed_at`, `dismissedIds`). `loadNotifications()`:
  előbb `collect_season_notifications()` és `collect_release_notifications()`. `navigator.setAppBadge()`. Új
  olvasatlannál egyszer megrezzen (`.ringing`). A `collection_new` elemre kattintva előnézet. A `mama_interested` csak
  akkor látszik, ha a cím `mama_status`-a most is „Érdekli” / „Megkapta” (`shownNotifications`).
- `lib/popupSide.js` + `lib/usePhonePopup.js` – a harang és a ⋮ listájának iránya; telefonon portálon a `body`-ba
  (a fejléc gombsorának transzformja a `position: fixed` listát különben a gombsorhoz igazítaná); a kívülre kattintás
  vizsgálata a lista elemét is nézi.
- `components/StatsDialog.js` + `lib/stats.js` – Statisztika a betöltött listából (`listStats()`; `tasteProfile()` –
  műfaj legalább 3 értékelt címtől, `TASTE_MIN`); színes csempék (`.tile[data-tile]`), `FranchiseBar`; telefonon a havi diagramon minden második hónapnév (`.month.alt` rejtve).
- `components/BackupsDialog.js` + `lib/backups.js` – Mentések: lista, „Mentés most” (`create_my_backup`),
  „Visszaállítás” helyben megerősítve (`restore_my_backup`), utána `reloadAfterRestore()` (`useListData`).
- `lib/errorLog.js` + `components/ErrorsDialog.js` – hibanapló (terv-3 113): `startErrorLog()` (az `app/page.js`
  indítja: `error` → 'error', `unhandledrejection` → 'rejection'), a hibalap (`ErrorScreen`) → 'render', a
  sikertelen adatbázis-művelet → 'save' (`reportError(error)` – **a kliensoldali `console.error(error)` helyett ezt
  használd**; konzolra is ír). `logError(kind, error)` → `log_client_error` RPC; kihagyja a hálózati hibát, a
  megszakítást, a böngésző zaját (`NOISE`), net nélkül nem küld; munkamenetenként ugyanaz percenként egyszer, összesen
  ≤ 30. A ⋮ „Hibák (N)” csak ha van sor (`errorCounts()` → `{ total, unseen }`, net nélkül nincs); az ablak: a
  legutóbbi elöl, „Új” / „Mamánál” jelzés, „Részletek” (hely, verzió, böngésző, verem), „Másolás” / „Összes
  másolása” (Claude-nak beilleszthető szöveg), törlés, „Összes törlése” helyben megerősítve; megnyitáskor a látottak
  olvasottak (`markErrorsSeen`). Teszt: `test-113.mjs`.
- `components/PasswordDialog.js` – jelszócsere (terv-3 27): a jelenlegi jelszót egy **külön, nem tároló
  Supabase-kliens** ellenőrzi (`checkPassword`: `persistSession: false`, saját `storageKey`, utána `signOut({ scope:
  'local' })`), aztán `updateUser`; a hibakódok magyarul (a belépésé és az ellenőrzésé közösen: `lib/authErrors.js`
  `signInErrorKind` – net nélkül / túl sok próbálkozásnál nem a jelszót gyanúsítja). Elfelejtett jelszó nincs. Teszt: `test-27.mjs` (a
  tesztfiók jelszavát a végén mindenképp visszaállítja).
- `components/ManualDialog.js` + `scripts/leiras.mjs` – felhasználói leírás az appban: a `FELHASZNALOI-LEIRAS.md`-ből
  a `npm run dev` / `npm run build` elején készül a `public/leiras/leiras.html` + képek (a mappa git-ből kizárva;
  `marked` – fejlesztői függőség). Fejlécazonosítók `leiras-` előtaggal; ①–⑳ → `span.jel`. A belső linkek az
  ablakon belül görgetnek. Teszt: `test-48.mjs`.
- `components/BulkImport.js` + `lib/bulkImport.js` – Tömeges import (csak asztalon): soronként egy cím (≤ 150 –
  `MAX_LINES`; a sor végi évszám szűr), `matchEntry()` (biztos = egyetlen pontos egyezés), felvétel 2-esével; a végén a találat nélküli, a sikertelen keresésű
  és a fel nem vett sorok a szövegmezőben maradnak;
  `mapLimit`.
- `components/ImdbRatingsImport.js` + `lib/imdbImport.js` – IMDb import: értékelések (`applyMyRatings` – csak a
  listán lévők, az IMDb csillaga felülírja a sajátot, az állapot nem változik, új cím nem kerül fel) vagy
  figyelőlista (`planWatchlistImport`, `/api/tmdb/find`, kipipálható lista, felvétel 2-esével). Bezárás után a futás
  a háttérben végigfut, az ablakhoz nem nyúl (`runRef`; a Tömeges import is). Automatikus IMDb-szinkron nincs (nincs
  API, a gépi olvasás tiltott).
- `lib/exportList.js` – „Mentés letöltése”: CSV (UTF-8 BOM, pontosvessző, tizedesvessző – Excelben jól nyílik).

### Mama
- `components/MamaView.js` + `components/MamaDetail.js` – Mama oldala (terv-3 13, „B”): „Norbi filmjei”, téma,
  Kilépés; rendezés, kereső, menü, harang nincs. Fülek: „Filmek” (jelöletlenek, alapból; egyszerre 5, „További
  filmek” +5) / „Érdekel” (egyben minden; `.mama-tabs`). A `mama_list()` filmjei; soronként „Érdekel” (borostyán) /
  „Nem érdekel”: a „Filmek” fülön mindkettő leveszi a sort (az adatlapot is zárja), helyére jön a következő, 8 mp
  „Visszavonás”; az „Érdekel” fülön a „✓ Érdekel” újra kattintva visszavon, a sor a fülváltásig marad (`kept`);
  optimista `mama_mark()` (címenként sorba állítva), hibánál visszaáll. Adatlap (`dialog.editor.mama-detail`):
  háttérkép, előzetes, „Hol nézhető?”, a két nagy gomb; a film színében dereng; telefonon alsó lap. Helyben nem tárol
  (net nélkül üres / hiba). Visszatéréskor `useAppFreshness` (csendes `load(true)`; menet közbeni jelölésnél kihagyja). E2e: „Mama oldala (terv-3 13)…” a Mama-tesztfiókkal.

### Közös könyvtárak
- `lib/supabase.js` – kliens. `lib/api.js` – `apiGet()`: saját `/api` route `Authorization: Bearer` tokennel,
  hibánál a szerver magyar üzenetével dob.
- `lib/titles.js` – címműveletek (a `titles_with_genres` friss sorát adják vissza, törlés kivételével):
  `addTitle(item, details?, { watched, franchise_id })` (műfajok upsert → `titles` → `title_genres`, hibánál
  visszavonás; sorozatnál az évadok is – a megjelentek `aired_notified = true`; `watched`: Megnézve, ma, a
  megjelent évadok megnézve; a függő törlést visszavonja – `registerPendingDelete`), `updateTitle`, `deleteTitle`,
  `createFranchise`, `renameFranchise`, `deleteFranchise`; évadok: `setSeasonStatus` (→ `{ row, filled, previous
  }`), `markAllSeasonsWatched`, `restoreSeasons`, `setSeasonDownloaded`, `addSeason`, `removeLastSeason`,
  `seasonAired`, `NEXT_SEASON_STATUS`; háttér: `refreshSeasons`, `refreshReleases`, … (utolsó paraméter
  `isCancelled`; a frissített sorok számát adják). `releaseState(t)` (`{ kind: 'soon' | 'cinema' }` / null; a
  mozis bemutató után 120 napig moziban), `formatReleaseDate`, `releaseLabel`, `releaseKey(t, évad?)` (rendezési
  kulcs; csak évnél `"YYYY-12-32"`), `mamaApplies(t)`, `DETAILS_V`, `CREDITS_V`, `SIMILAR_V` (**a válasz mezőinek /
  szűrésének változásakor emeld**; a kérők mind innen veszik), `externalLink`, `formatDate`, `todayDate()` (budapesti idővel, szerveren is), `budapestDay`,
  `DEFAULT_STATUS`, `DROPPED_STATUS`, `MAMA_OPTIONS`, `mamaLabel`, `isPendingDelete`. A franchise nevét a kliens
  keresi ki (nincs a nézetben).
- `lib/rowSaves.js` – `saveRow(sor, apply, kérés, show)`: soronként sorba állított optimista mentés; a képernyőn az
  utolsó szerversor + a függő módosítások; hibánál csak a sikertelen esik ki. `hasPendingSave`, `isOptimistic(row)`
  (mellékhatást csak mentett sorra). **Új optimista mentésnél ezt használd.** Teszt: `test-audit-9.mjs`.
- `lib/fetchAll.js` – a PostgREST kérésenként legfeljebb **1000 sort** ad: ezres adagok (`.range`), egyértelmű
  rendezéssel. **Új, a teljes listát lekérő lekérdezésnél ezt használd.**
- `lib/refreshDue.js` – „esedékes-e” szabályok: `imdbDue` (14 nap), `backdropDue`, `seasonsDue` (7 nap),
  `releaseDue`, `detailsDue` (havonta, a meg nem jelentnél hetente), `collectionDue`, `collectionPartsDue` (7 nap),
  `personDue` (7 nap), `budapestToday`. **A route-ok ugyanezt kérdezik (részben SQL-ben) – változtatáskor mindkét helyen.**
- `lib/posterColor.js` – `usePosterColor(poster_path, enabled)`: hangulatszín a w92-es borítóból, **saját
  gyorsítótár-kulccsal (`?szin`)** – ha ugyanaz a kép CORS nélkül is a gyorsítótárban lenne (pl. a harang képei), a
  vászon tiltást kapna; OKLCH, L 0,72, C 0,04–0,13; borítónként egyszer. `ambientProps(szín)` → `--ambient` +
  `data-ambient`. `franchisePosterPath(id, titles)` – a franchise színének borítója (a legjobb IMDb-értékelésű,
  borítós cím).
- `lib/viewTransition.js` – `canMorph`, `MORPH_NAME`, `trackTransition`, `afterTransition()`: **a szerkesztő
  megnyitásakor érkező új, nem sürgős állapotfrissítést ezzel késleltesd** (terhelt gépen akadást okozott).
- `lib/useMediaQuery.js`, `lib/useStrike.js` (kihúzás-animáció, terv-3 40: a `.strike` span kulcsa / `data-strike`).
- `lib/useBackdropClose.js` – `useBackdropClose(dialogRef, { onClose, canClose, onBlocked })` (ha nem zárhat: `nudgeDialog()` – az ablak megbillen, `dialog[data-nudge]`; az adatlap lapváltásnál is) → `{ onPointerDown,
  onClick }`: kikattintásra zár (a lenyomás is kívül legyen), telefonon (≤ 640 px) nem; a beágyazott ablak
  kattintása nem számít kívülnek. Mikor nem zár: adatlap (megerősítés / név gépelése / felvétel), Színészek és
  rendezők (felvétel az idővonalon), Toplisták (felvétel), Franchise-ok
  (szerkesztés, megerősítés, nyitott gyűjtemény-ablak), gyűjtemény-ablak (rész felvétele, sorrend-szerkesztés,
  megosztás visszavonásának megerősítése, fejléc szerkesztése; a nyitott TMDB-keresőnél zár, a Franchise-ok ablakból
  nyitva mindkettő – `onOutsideClose`), Mentések (művelet / megerősítés), Hibák („Összes törlése” megerősítése / törlés), Jelszó (beírt jelszó / mentés);
  Statisztika és Leírás mindig zár; az importablakok soha (Norbi döntése).
- `lib/backClose.js` – a Vissza gomb a legfelső réteget zárja (terv-3 62): rétegenként egy `history.pushState`
  bejegyzés (az URL nem változik); ha máshogy zárul, `history.back()`. A modális `<dialog>`-okat MutationObserver
  kezeli (a Vissza az Esc-et utánozza) – **új ablakhoz nem kell semmi**; saját szabály: `dialog.backHandler` →
  'stay' | 'stepped' | 'closing'. Nem dialog réteg: `useBackLayer(open, close)` (⋮, harang, „Cím hozzáadása”
  panel). Saját visszalépés alatt új bejegyzés nem kerül fel, csak utána. **Android**: nyitott modális ablaknál a
  vissza-gesztus `cancel`-ként az ablakhoz jut, ezért az adatlap `closedby="none"`, az Esc-et `keydown` kezeli; az
  adatlap újabb lapjai saját bejegyzést kapnak (`pushDialogPage` / `popDialogPage`, bezáráskor `history.go(-n)`).
  Teszt: `test-1013b.mjs`, `test-gesztus.mjs`.
- `lib/appVersion.js` + `/api/version` – `useAppFreshness`: legalább 5 perc rejtés után csendes újratöltés; a
  build-azonosító (`NEXT_PUBLIC_APP_VERSION`, `next.config.mjs`) eltérésekor „Frissült az app” sáv (munkamenetenként
  egyszer, `duration: null`).
- `lib/prefetch.js` – `usePrefetchOnHover(t)`: ~150 ms rámutatás után a providers / credits / videos / images route
  előtöltése **ugyanazzal az URL-lel, mint a `TitleEditor` – ha ott a paraméterek változnak, itt is** (a `v` közös
  konstans).
- `components/PullRefresh.js` – lehúzás frissítéshez, csak érintéssel és a telepített appban (`isStandalone()`);
  nyitott `dialog`-nál / belül görgetett elemben nem; `<html data-pull-refresh>`. Teszt: `test-1014.mjs`.
- `lib/liveSync.js` – élő szinkron (Supabase Realtime, terv-3 86): `useLiveSync(enabled, userId, { onTitles(ids,
  deletedIds), onNotifications, onFranchises, onResync })`; feliratkozásonként új csatornanév; a törlésről csak a
  kulcs jön; 0,4 mp-ig gyűjt. A címeket 500-asával tölti újra (`SYNC_CHUNK`), a régebbi válasz az újabbat nem írja
  felül (`syncAsked`); a törölt kiválasztott franchise szűrője elenged. A `useLiveTitles` (`components/list/`) a
  saját visszhangot, a függő mentésű (`hasPendingSave`) és a függő törlésű (`isPendingDelete`) címet kihagyja; a meglévőt a `replaceTitle`-lel cseréli; az újbóli beszúrás a törlést érvényteleníti.
- `public/sw.js` + `lib/offline.js` – service worker (csak a kiadott változatban; `next.config.mjs`: `/sw.js`
  `no-cache`): az oldal hálózatról 3 mp-es korláttal, a `/_next/static/` és a TMDB-képek tárolóból; az
  `/api` és a Supabase nem. A TMDB-képek két tárolóban: a lista borítói és a franchise-logók (`POSTERS`, korlát
  nélkül – a service worker a tárolt listából dönti el, mi ide tartozik; `LIST_SIZES` w342 / w185 – **a `PosterCard` /
  `TitleTable` / `FranchiseFilter` képméretének változásakor itt is**), minden más ≤ 400 (`EXTRA_LIMIT`); a `?szin`
  sehol. A lap elküldi a használt programfájlokat (`assets`), a régiek törlődnek; ekkor és kilépéskor (`posters`
  üzenet) a borítótároló a listához igazodik. **A tárolás
  módjának változásakor emeld a `VERSION`-t.** Lista: IndexedDB `filmlista` / `snapshots` (`loadSnapshot` /
  `saveSnapshot` / `clearSnapshots`), `useOnline()`. Teszt: `test-44.mjs`.

### Szerveroldal
- Minden `lib/server/` modul `import 'server-only'`-val kezdődik (új szerveroldali modulba is tedd bele).
- `lib/server/auth.js` – `getUserFromRequest()` (a tokent helyben, `auth.getClaims()`-szel ellenőrzi, JWKS
  gyorsítótárazva; egy máshol kijelentkeztetett token a lejáratáig elfogadott – az adatot az RLS védi),
  `supabaseAsUser()`, `unauthorized()`. Az `/api/tmdb/*` token nélkül 401.
- `lib/server/tmdb.js` – `tmdbFetch()` (10 mp-es időkorlát, az OMDb is), `tmdbErrorResponse()`, `titleParams(request)`
  (`?type=movie|tv&id=` → `{ type, id }` vagy `{ bad }` 400-as válasz – a címhez tartozó route-ok),
  `cachedResponse(body, mp)` (`Cache-Control: private, max-age`; `DAY_S`, `HOUR_S`; **hibás vagy részben hiányos
  válasz soha nem tárolható** – ilyenkor sima `Response.json`), `cached(kulcs, ms, betöltő, keep?)` (memória, ≤ 500
  elem; az egyszerre érkező hiányok egy betöltést várnak; hibát és `keep` szerint hamisat nem tárol),
  `pickReleaseDates()` (mozi 3, ha nincs 2; digitális 4; HU, ha nincs US), `pickSeasons()` (0. évad nélkül),
  `pickOverview()` (magyar, ha nincs angol), `yearOf()`, `ANIMATION_GENRE`.
- `lib/server/omdb.js` – `fetchImdbRating()`, `omdbEnabled()`. `lib/server/collections.js` – `loadCollection()`.
- Lekérő route-ok (`app/api/tmdb/…`, GET): `search` (multi: film / sorozat + `people` – színész / rendező, `peopleFirst`), `details` (a `titles` oszlopai +
  `genres`, sorozatnál `seasons`; magyar leírás híján angol; OMDb – ha nem sikerül, a cím attól még felvehető;
  filmnél gyűjtemény, `release_date`), `find` (IMDb ID → TMDB), `similar` (≥ 2000, TMDB ≥ 6,0, ≥ 50 szavazat,
  animáció nélkül, ≤ 12; a kliens `SIMILAR_V` – **a szűrés változásakor emeld**), `videos` (YouTube, Trailer és hivatalos
  előbb, magyar, ha nincs angol), `providers`, `credits`, `images`, `person`, `logos`, `discover`, `featured`,
  `collection`, `collection-search` (`?suggest=`), `toplist` (`?type=&list=`; lásd Toplisták). Ha a cím már nincs a TMDB-n: üres / null.
- Háttérfrissítő `POST` route-ok (a felhasználó jogaival, kötegekben; a `Watchlist` betöltéskor hívja,
  körszám-korláttal): `imdb/refresh` (25), `tmdb/seasons` (10; új évadot, nevet, epizódszámot, dátumot ír, az
  állapothoz nem nyúl; ismert sorozat új jövőbeli évada → `season_announced`, új megjelent évad `aired_notified =
  false`), `tmdb/backdrops` (40), `tmdb/releases` (40), `tmdb/title-collections` (40), `tmdb/collection-parts` (8
  franchise; új rész → `collection_new`, ha nincs a listán és nincs elrejtve; első ellenőrzéskor és új gyűjteménynél
  csak megjegyzi; **előbb az értesítést írja, utána az ismert részeket**; a 404-es gyűjtemény üres; ha egy
  gyűjtemény nem tölthető le, nem jelöli ellenőrzöttnek), `tmdb/details-refresh` (40; az esedékességet a kis oszlopokból dönti el, a teljes sort csak a 40-é kéri; `{ id }`-vel egy cím kézzel;
  a címet **csak akkor** cseréli a magyarra, ha most az eredeti áll ott – a kézzel adott címek maradnak; leírás,
  borító, dátum, műfajok; a saját adatokhoz nem nyúl; mindig beírja a `details_checked_at`-et), `franchises/logos`,
  `people/refresh` (8 követett személy; a főszerepben / rendezőként jegyzett filmjei – animáció, dokumentum,
  önmaga nélkül – az ismertekhez mérve; ha még nincs ismert filmje, csak megjegyzi; új, **dátummal** bejelentett,
  30 napnál nem régebbi, nem listás, nem elrejtett film → `person_new`; előbb az értesítés, utána az ismertek).
- `app/api/keepalive` + `vercel.json` (napi cron) – a Supabase ingyenes projekt ébren tartása (`CRON_SECRET`, ha
  van).
- `.github/workflows/mentes.yml` – heti külső mentés (hétfő 04:30 UTC, `BACKUP_DB_URL`): felhasználónként a
  legfrissebb mentés JSON-ba, artifact 56 napig (a futás Summary oldalának alján); 8 napnál régebbi mentésnél hibával
  áll le. Visszatöltés: `munka/e2e/mentes-feltoltes.mjs <fájl.json> <e-mail>` → „Feltöltött” mentés. A
  `backup_reader` jelszavának cseréje: `mentes-olvaso.mjs`, utána a GitHub-titok is.

### Dokumentáció
- `supabase/*.sql` – a már lefuttatott adatbázis-szkriptek (számozva).
- `FELHASZNALOI-LEIRAS.md` – felhasználói leírás Norbinak (képek: `docs/kepek/*.jpg`, a
  `munka/terv-3/33-leiras/leiras-seed.mjs` + `leiras-kepek.mjs <név>` készíti); frissítése: Konvenciók →
  „Felhasználói leírás”.

## Adatbázis (lásd `supabase/`)
- `genres (id = TMDB műfaj ID, name)`. `statuses (code, name, sort_order)`: `to_watch`, `watching`, `watched`,
  `dropped` (Abbahagyva – a felület csak sorozatnál kínálja). Új állapotnál szín és CSS is kell (Konvenciók).
- `titles` – `user_id` (default `auth.uid()`), `media_type` ('movie' | 'tv'), `title`, `original_title`,
  `release_year`, `release_date` (film: `release_date`, sorozat: `first_air_date`), `overview`, `poster_path`,
  `backdrop_path`, `tmdb_id`, `imdb_id`, `status`, `is_downloaded`, `mama_status` (null | 'interested' | 'declined' |
  'received'; a 'declined'-et Mama jelöli, Norbinál tompa szürke), `franchise_id` (on delete set null; csak saját
  franchise lehet), `imdb_rating`, `imdb_votes`, `my_rating` (1–10), `notes`, `watched_at`; filmnél
  `theatrical_release`, `digital_release`, `tmdb_collection_id`, `franchise_suggestion_off`; ellenőrzési
  időbélyegek: `imdb_rating_updated_at`, `seasons_checked_at`, `backdrop_checked_at`, `release_checked_at`,
  `collection_checked_at`, `details_checked_at`; `created_at`, `updated_at` (trigger). Egyedi: `(user_id,
  media_type, tmdb_id)`.
- Trigger: „Megnézve”-re váltáskor (vagy megnézettként felvéve) az `is_downloaded` hamis lesz; utána kézzel újra
  bejelölhető. A felület is azonnal leveszi a pipát.
- `title_seasons (title_id → titles cascade, season_number ≥ 1, user_id, name, episode_count, air_date, status,
  is_downloaded, watched_at, aired_notified, …)`, PK `(title_id, season_number)`. Triggerek: megnézettre váltáskor az
  évad `is_downloaded` hamis, `watched_at` = ma; minden változás után a sorozat `status` / `is_downloaded` /
  `watched_at` az évadokból számolódik (`seasons_summary(title_id)`): minden megjelent (`air_date` ≤ ma) évad
  megnézve → `watched`; van megkezdett / megnézett → `watching`; különben `to_watch`; letöltve = van letöltött évad;
  a bejelentett évad nem számít. Kivétel a `dropped`: kézi, csak a letöltve követi az évadokat. Évados sorozat
  `status`-ának közvetlen írásakor (`titles_status_from_seasons`) a `dropped` kivételével mindig az évadokból
  számolt érték kerül be (így a „Mégis folytatom” bármit küldhet). Évadok nélkül a cím kézi.
- `franchises (id, user_id, name, created_at, logo_path – null: még nincs / '' : „Csak a név”, logo_checked_at,
  tmdb_collection_ids integer[] – NULL is lehet, üresnek veendő –, collections_checked_at)`; egyedi `(user_id,
  lower(name))`.
- `franchise_order (franchise_id, title_id, season_number ≥ 0 – 0: film / évad nélküli sorozat –, user_id,
  position)`: csak a sorrend. `set_franchise_order(franchise, items jsonb)` – egy tranzakcióban cserél. Trigger: más
  franchise-ba került cím kikerül a régi sorrendből.
- `franchise_collection_parts (franchise_id, collection_id, tmdb_id, user_id)`: a gyűjtemények ismert részei (ebből
  derül ki, mi az új); nincs a mentésben.
- `hidden_suggestions (user_id, media_type, tmdb_id, title, poster_path, release_year)`: „Nem érdekel”-lel
  elrejtett ajánlások.
- `followed_people (user_id, person_id, role 'actor' | 'director', name, profile_path, created_at, checked_at)`, PK
  `(user_id, person_id, role)`: a követések (M4). `followed_person_credits (user_id, person_id, role, tmdb_id)` → a
  követés cascade: a személy ismert filmjei; nincs a mentésben (visszaállításkor üres – a következő ellenőrzés
  „első”).
- `notifications (id, user_id, title_id → titles cascade, season_number, kind, air_date, created_at, read_at,
  dismissed_at, franchise_id → franchises cascade, part_tmdb_id, part_title, part_poster_path, part_year, person_id,
  person_name, person_profile_path)`. `kind`: 'season_announced' | 'season_aired' | 'movie_digital' (filmnél
  `season_number = 0`) | 'mama_interested' | 'collection_new' (ilyenkor `title_id` üres, a franchise és a rész
  adatai) | 'person_new' (`title_id` üres, a személy és a film adatai; `notifications_target_check`). Egyedi
  `(title_id, season_number, kind)`, `(franchise_id, part_tmdb_id)` és `(user_id, person_id, part_tmdb_id)`. A törölt (`dismissed_at`) sor megmarad, így a
  gyűjtők nem írják újra; Mama újbóli „Érdekel”-je üríti. `collect_season_notifications()` (a megjelent, még nem
  jelzett évadokról; abbahagyottról és megnézettről nem), `collect_release_notifications()` (14 napon belüli
  digitális megjelenés, ha a felvételkor még nem jelent meg és nincs megnézve).
- `backups (id, user_id, kind ('weekly' | 'manual' | 'before_restore' | 'imported'), created_at, title_count,
  data jsonb)`. A `data` a felhasználó sorai változatlanul (`backup_snapshot(user)`, version 4: `franchises, titles,
  title_genres, genres, title_seasons, notifications, franchise_order, hidden_suggestions, followed_people`; a
  régebbi verziókban az utóbbi három hiányozhat – visszaállításkor azok nem változnak). RLS: a sajátját látja / törli, írni csak a
  függvények. `write_backup(user, kind)` (üres listáról nem ment; a 8 hétnél régebbieket törli),
  `backup_all_users()` (pg_cron `filmlista-heti-mentes`, hétfő 03:00 UTC), `create_my_backup()`,
  `restore_my_backup(id)` (előbb `before_restore` mentés; eredeti azonosítókkal tölt vissza). A belső függvényeket
  anon / authenticated nem hívhatja. **Visszaállítás alatt `set_config('filmlista.restoring', 'on', true)`**: a
  `clear_downloaded_when_watched`, `title_seasons_before_write`, `sync_title_from_seasons` trigger ilyenkor nem
  módosít – ha ezeket módosítod, a jelző-vizsgálat maradjon az elejükön. `backup_reader` szerep: csak a `backups`
  táblát olvassa. A `session_replication_role` itt nem állítható.
- `franchise_shares (franchise_id PK, user_id, token – 32 hexa jegy, created_at)`: visszavonás = a sor törlése;
  nincs a mentésben. `shared_watch_order(token)` (security definer, `anon` is): a franchise neve, logója,
  háttérképe, `poster_path`-ja, a címek (megjelenítési adatok, évadok) és az `order`; állapot, értékelés, letöltve,
  Mama, megjegyzés, user_id soha; hibás tokenre null.
- `list_viewers (viewer_id PK, owner_id, created_at)`: Mama (néző) → Norbi (gazda); írni csak SQL-ből
  (`munka/e2e/mama-kapcsolas.mjs`); a Mama-tesztfiók a tesztfiókhoz kötve; nincs a mentésben. `mama_list()`
  (security definer, csak `authenticated`): a gazda megnézendő, franchise nélküli, jelöletlen, már megjelent
  (`title_released(t)`) filmjei, valamint az `interested`-ek (a Megkaptáig), `created_at desc`, csak megjelenítési
  oszlopok. `mama_mark(title_id, choice)`: csak a `mama_status`-t írja, „Megkapta”-ra nem; „Érdekli”-re
  `mama_interested` értesítés. **`title_released(t)` a `releaseState()` szabálya SQL-ben – ha az egyik változik, a
  másikat is.** Mama a `titles` táblát közvetlenül nem látja. Teszt: `test-17.mjs` (`--live`).
- `client_errors (id, user_id – akinél történt, owner_id – akinek a naplójában van: Mamánál a gazda, kind 'error' |
  'rejection' | 'render' | 'save', message ≤ 500, stack ≤ 4000, url, app_version, user_agent, fingerprint, count,
  first_at, last_at, seen_at)`, egyedi `(user_id, fingerprint)`: hibanapló (terv-3 113). Írni csak a
  `log_client_error(kind, message, stack, url, app_version, user_agent)` (security definer, `authenticated`) tud: a
  fingerprint a fajta + az üzenet + a verem első sora, számjegyek nélkül; ismétlődésnél `count + 1`, `last_at`, újra
  olvasatlan; óránként ≤ 60 új sor felhasználónként, a 30 napja nem ismétlődött és a 200 legfrissebb fölötti törlődik.
  RLS: a gazda olvassa / olvasottra állítja / törli (Mama a sajátját nem látja). Nincs a mentésben, nincs a Realtime-ban.
  A `clearTestAccount()` üríti.
- `imdb_ratings (imdb_id PK, rating, votes, checked_at)` és `toplists (key PK – 'movie:all' …, items jsonb, complete,
  built_at)` (terv-3 120): **közös** (nem felhasználói) gyorsítótár a toplistákhoz; minden belépett olvassa, írni csak
  a `store_imdb_ratings(items)` / `store_toplist(key, items, complete)` tud; `imdb_ratings_today()` – a mai
  OMDb-kérések. Nincs a mentésben, nincs a Realtime-ban.
- `title_genres (title_id, genre_id)`. `titles_with_genres` nézet (`security_invoker`): `titles.*` + `status_name` +
  `genres text[]` + `seasons jsonb`.
- Realtime: a `titles`, `title_seasons`, `notifications`, `franchises` a `supabase_realtime` publikációban (a
  törlésről csak a kulcs megy ki).
- Minden táblán RLS: a felhasználó csak a saját sorait látja / módosítja.
- **Szabályok:**
  - Sémamódosításnál új számozott SQL fájl a `supabase/` mappába. Ha a nézet oszlopai változnak (a `t.*` is!), a
    nézetet újra kell létrehozni (`drop view` + `create view`).
  - **Mentett táblába új oszlop csak NULL-t engedő** (vagy a visszaállítás tölti ki), különben a régi mentések nem
    állíthatók vissza.
  - Futtatás: Claude a `SUPABASE_DB_URL`-lel (Session pooler, admin, RLS nélkül) a `pg` csomaggal (a scratchpadbe
    telepítve), egy tranzakcióban (hibánál `rollback`). Csak a `supabase/` számozott fájljait futtasd; adatot törlő
    vagy táblát eldobó lépés előtt kérdezz rá (a nézet újralétrehozása kivétel). Utána ellenőrizd.
  - Push csak a séma után (az új kód az új oszlopokra számít).

## Konvenciók
- Felületi szövegek magyarul, mondatkezdő nagybetűvel, cselekvő igékkel (pl. „Hozzáadás a listához”, nem
  „Submit”). A hibaüzenet mondja meg, mi a baj és mit tegyen a felhasználó.
- Az alapállapot (`to_watch`, `DEFAULT_STATUS`) a felületen **üresen** jelenik meg: nincs „Megnézendő” felirat a
  soron / kártyán / ablakban, és nincs színe; csak a szűrőgomb nevezi meg. Az adatlapon a kiválasztott állapotra /
  Mamára újra kattintva üres lesz.
- A megnézett és az abbahagyott címek háttérbe húzódnak (sor és kártya): fekete-fehér, fakó borító, tompított, de
  olvasható szöveg (`--watched-text`, ≥ 4,5:1), halványabb vezérlők, szürke műfajpötty és „M” – nem az egész sor
  átlátszó. Rámutatáskor és fókusznál minden teljes színű.
- **Két téma**: a sötét az alap (`:root`), a világos az `app/styles/02-vilagos.css`-ben
  (`:root[data-theme='light']`). **Új színtokennél a világosba is kell érték**, és a kontrasztot mérd
  (`munka/terv-3/terv-50/kontraszt.mjs`, `VEGLEGES=1`). **Beégetett színt ne használj**: fátyol `rgb(var(--tint) /
  0.05)`, árnyék `rgb(var(--shade) / calc(0.6 * var(--shade-k)))`, üveg `rgb(var(--glass) / 0.8)`, `::backdrop`
  `rgb(var(--scrim) / calc(0.62 * var(--scrim-k)))`; teli piros gomb felirata `--danger-ink`.
- **A film / franchise színe (`--ambient`)**: keverési arány `min(100%, calc(N% * var(--ambient-k)))` (sötétben 1,
  világosban 1,7), teli színű vonal / ikon `var(--ambient-ink)`; a mezőcímke (`--ambient-label`) és a `::backdrop`
  kivétel. **Új `--ambient`-es szabálynál is így.**
- **Sötét szigetek**: a képes sávok világosban is sötétek (a filmlogók fehérek) – `.featured-slide`, `.featured-sk`,
  `.collection-banner[data-backdrop]`, `.share-hero[data-backdrop]`, `.fr-logo`, galéria: a sötét tokeneket a
  `:root` szabály kiválasztója adja nekik (a P3-asé is). Új képes sávnál ide is fel kell venni.
- Színek: kiemelőszín (`--accent`) neon türkiz `#33e0ef`, a „Folyamatban” is ez; állapotszínek `--st-<kód>`
  (Abbahagyva halvány lila). Új állapotnál szín és `[data-status=...]` szabály is kell (kártya és sor).
- Második kiemelőszín (`--accent-2`, borostyán `#ffb547`, `-ink`, `-soft`, `-line`): **csak a saját jelöléseken** –
  saját értékelés, Mama, a harang száma és Mama-értesítése, a Statisztika értékelés-csempéi. Soha nem gombszín; a
  türkiz marad a gomboké, az állapotoké, a kiválasztott szűrőké és a fókuszkereté.
- Tartalomfajták színei: `--c-coral` mozi, `--c-indigo` bejelentett / hamarosan (a még meg nem jelent évad / rész
  mindenhol indigó szaggatott, `data-upcoming`), `--c-sky` digitális / letöltve, `--c-sage` megjelent (=
  `--st-watched`), `--c-rose` ajánlás. Mindig ugyanazt jelentik, **soha nem gombszínek**; teljes erővel csak apró
  jelölésen, nagy felületen halvány árnyalatként.
- A színtokenek OKLCH-ban (mellettük megjegyzésben a hex); P3 kijelzőn (`@media (color-gamut: p3)`) élénkebb
  `--accent` / `--accent-2`. A build hex / `lab()` tartalékot generál, ezért a teszt a színeket vásznon át, sRGB-ben
  hasonlítja (`rgbOf`). Új színt OKLCH-ban adj meg (hexből: `munka/dizajn-2/eszkozok/oklch.mjs`).
- Teli türkiz csak a fő műveleteknél (Cím hozzáadása, Hozzáadás a listához, Belépés); a kiválasztott állapot
  `--accent-soft` háttér + `--accent-line` keret. A gombok kerek végűek, rámutatva világosodnak, lenyomva sötétednek
  (`--accent-hover/-press`, `--hover-tint/--press-tint`).
- Saját lenyíló-nyíl (`--chevron`, `appearance: none`) és jelölőnégyzet (`--check-mark`); ahol egy szabály
  `background` rövidítést ad egy lenyílónak, a nyilat is újra meg kell adni. Windows nagy kontrasztú módban a
  beépített vezérlők maradnak. A natív `<select>` listája `appearance: base-select`-tel (`@supports` mögött) az app
  stílusában nyílik; a szűrősor (telefonos) lenyílóinak opciói előtt érték szerinti ikon (`--opt-icon`) / szín
  (`--opt-dot`) – **új opciókódnál ide is kell ikon, és asztalra a `components/FilterIcons.js`-be is**.
- **Mozgás**: legfeljebb ~0,2 s-os átmenetek. Kivételek az `app/styles/36-mozgas.css`-ben (aurora, nézetváltás,
  lista ↔ rács, lenyílók, beúszások, átrendeződés, csillag, pipa, harang, csontváz, toast-csík, kihúzás). A
  legutolsó fájlban (`46-kevesebb-mozgas.css`) egy közös `prefers-reduced-motion: reduce` szabály mindent kikapcsol; a JS-ből indított
  mozgások (`Reflow`, `viewSwitch`, nézetváltás) a „kevesebb mozgás”-t maguk nézik.
- Görgetősáv: saját (`::-webkit-scrollbar`, `app/styles/05-urlap.css`). Elemre ne adj `scrollbar-width` /
  `scrollbar-color`-t (Chrome-ban akkor a `::-webkit-scrollbar` nem érvényes).
- Hiányzó borító: a `.thumb:empty` / `.poster-fallback` filmikont kap (`--icon-film`).
- Anyag: álló filmszemcse (`body::after`); „squircle” sarkok (`corner-shape: squircle`, `@supports` mögött): borító
  22 px, kis borító 13 px, szerkesztő ablak 32 px, panelek 20 px, mezők 12 px; új lekerekített elemnél (és a
  `::before` / `::after` keretnek) is kell.
- Új dizájnötletnél: előbb látványterv / előtte–utána képek (`munka/dizajn-2/eszkozok/`), beépítés csak Norbi
  jóváhagyása után.
- **Új ablaknál (`<dialog>`) mindig vizsgáld a kikattintásos bezárást** (`useBackdropClose`, `canClose`): mikor ne
  zárjon (bevitel / szerkesztés / megerősítés / folyamatban lévő művelet). Ha szándékosan nem zár, írd oda
  megjegyzésben és ide. Ha egy másik `<dialog>`-on belül nyílik a React-fában, a külső `onClose` csak a sajátjára
  zárjon (`e.target === e.currentTarget`) – a React a belső „close” eseményét is továbbítja.
- Képekhez sima `<img>`, nem `next/image`. Nincs middleware / proxy; az auth kliensoldali.
- **Felhasználói leírás** (`FELHASZNALOI-LEIRAS.md`): **időszakosan frissül, nem minden fejlesztés után**. A
  fejlesztés commitjában a leíráshoz ne nyúlj; a frissítés a roadmap végén álló „Időszakos kézikönyv-frissítés”,
  Norbi kérésére. Menete: a leírás utolsó commitja óta készült változások (`git log $(git log -1 --format=%H --
  FELHASZNALOI-LEIRAS.md)..HEAD`) alapján a témák szerinti szakaszok, a változott felület képei (`leiras-seed.mjs`,
  majd `leiras-kepek.mjs <név>`; a jelölők és a szöveg számai egyezzenek), az „Utolsó frissítés” dátuma és a
  Változásnapló (legújabb felül). Norbi szemszögéből, a pontos feliratokkal; tervezett funkció nem kerül bele.
  Hangnem: könnyed, barátságos, tegező, de a tények pontosak; a Változásnapló tömör. A címsorokat ne írd át (a
  hivatkozások rájuk mutatnak). Utána a tesztfiókot ürítsd ki.
- Roadmap listázásakor minden pont mellé becsült időt írj (teszttel és doksival együtt).

## Elvetett ötletek – magadtól ne javasold újra
Norbi döntései; a részletek a TERV.md-ben.
- **Kinézet**: álló betűs eredeti cím, színskálás IMDb-jelvény, OLED fekete, 3D billenés a borítókon, plakátszerű
  tipográfia, számláló a fejlécben, „Ma este” kiemelt sáv, haladásgyűrű a sorozatoknál, egyedi helykitöltő a hiányzó
  borítóhoz, a kurzort követő fénylő kártyaél, mozgó borítófal a belépésnél, elmosottból kiélesedő borítók,
  kedvencek borostyán kerete, szikrák 10 csillagnál, felpörgő számok / felnövő oszlopok a Statisztikában, feltöltődő
  franchise-mérők, címlogó az adatlapon (49.1), borító-visszfény a borítófalon (51.6), élő aurora a borítók színéből
  (51.7), a türkiz tehermentesítése (51.2), állapotszín a kiválasztásban (51.3), csak a borító siklik megnyitáskor
  (C2), kisebb üvegelmosás (C3), görgetésre mozduló háttérkép, „Automatikus” téma (70), két magasságú alsó lap (71),
  érintési célok (77), összecsukódó adatlap-fejléc (105), egymásra rétegzett értesítősáv (106); mozis ötletkör (D1–D7, D11): lámpaoltás előzetesnél, filmszalagos
  hibalap, műsorfüzet-stílusú megosztott oldal, lyukasztott jegy a megnézetteken, filmszalagos nézési sorrend,
  függöny belépéskor, Ken Burns a jelenetképen, felületi hangok; polcnézet (D8), borítómozaik a Statisztikában (D12),
  franchise-univerzum (D13); a neonfelirat „rakoncátlan” betűje; akadálymentességi kör
  (A1–A4); kör alakú átmenet témaváltáskor (114).
- **Funkciók**: gyorsműveletek a borítón, parancspaletta / billentyűparancsok, „Mit nézzek ma?”, játékidő és szűrő
  rá, saját címkék, szinkron / felirat jelölése, csoportosítás hónapok szerint, évértékelő, web push; „Elérhető az
  előfizetéseimen” szűrő, share target, adatminőség-ellenőrző, „Letölthető most” gyorsnézet, megjelenési naptár,
  figyelmeztetés hasonló címre, mentett szűrő-összeállítások, díjak az adatlapon, alsó navigációs sáv telefonon,
  aktivitás-hőtérkép, rámutatásra leírás a borítófalon, sűrűségváltó, fülek az adatlapon telefonon; újranézés-napló,
  „Rég láttad” ajánló, változásnapló visszavonással, előzetes rámutatásra a Felfedezésben; tömeges import
  franchise-választóval / sorrend szövegből (ilyet Claude szkripttel tölt be); admin jogosultság (25), regisztráció
  (26), elfelejtett jelszó; Mama filmet kérhet, „Megkaptam” fül Mamánál, franchise-ugrás az adatlapról, Felfedezés
  műfaj szerint, „Kedvenceim” link, jelölés net nélkül (offline írás), automatikus füstteszt élesítés után;
  IMDb- / TMDB-link beillesztése a keresőbe (64), előző / következő cím az adatlapon (65), kattintható
  Statisztika-csempék (67), tömeges szerkesztés (68), „Továbbiak” görgetéssel telefonon (75); évszám a keresőben
  (81), lapozó nyilak a vízszintes sorokon (82), „Cím másolása” (87), „Nemrég megnyitott” (88); „Következőnek”
  kitűzés (89), „Következik” a franchise-sávon (90), megosztás az adatlapról (92), IMDb-küszöb szűrő (93), hangalapú
  keresés (94), „Új” jelvény (96), franchise-idővonal (97), rezgés jelöléskor (98); epizódszintű követés;
  szűrőgomb a még meg nem jelent filmekre; megjegyzés mező a felületen; C2 / C3 optimalizálás; kedvenc alkotók a
  Statisztikában (112), nyomtatható lista (115), visszaállítási próba (119).

## Fejlesztői megjegyzés
- Ha a terminál nem ismeri a `node`/`npm` parancsot, a VS Code-ot újra kell indítani (a Node a
  `C:\Program Files\nodejs` mappában van).
- Tesztfelhasználó: `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` a `.env.local`-ban – külön Supabase-fiók, az RLS miatt
  Norbi listáját nem látja. Soha ne írd ki az értékeit. A teszt végén a tesztfiók listáját ürítsd ki.
- Böngészős teszt: `playwright-core` a scratchpadbe telepítve (nem a projektbe), a gépen lévő Chrome-mal
  (`C:\Program Files\Google\Chrome\Application\chrome.exe`), a helyben futó `npx next start -p 3123` ellen. A tesztek
  és segédszkriptek a `munka/` mappában: a scratchpadbe másolva, ott `npm install` után futtathatók.
- Szkriptből (supabase-js) kilépéskor `signOut({ scope: 'local' })` kell – az alapértelmezett `global` a böngészőben
  futó munkamenetet is lezárja, és az `/api` route-ok 401-et adnak.
- A böngészős teszt „kevesebb mozgás” módban fut (`emulateMedia({ reducedMotion: 'reduce' })`); a mozgást a saját
  lépése kapcsolja vissza. A `page.reload` megvárja a friss listát (`main[data-list]`), a `plainReload` nem; a
  `clearSnapshot()` törli a tárolt listát. Fix várakozás helyett a mentés utáni friss sorra (`rowRefetched`) vagy két
  képkockára (`settle`) vár; képernyőkép csak `SHOTS=1`-gyel. Fő teszt: `munka/e2e/test.mjs`. A szűrősor lenyílóit
  a tesztek a `munka/e2e/szuro.mjs`-sel kezelik (`typeFilter`, `sortFilter`, `mamaFilterSelect`, `downloadFilter`:
  asztalon a saját panel / gombcsoport, telefonon a `<select>`, ugyanazokkal a módszerekkel).
- **Teljes tesztkör**: `munka/e2e/teljes.sh` (a scratchpadbe másolt e2e mappából, Git Bash-ben, ~25 perc):
  adatbázis- és böngészős tesztek (a próbalistát igénylők `leiras-seed` + `seed-52-1` után), a `test-audit-5` hibás
  TMDB-vel, a `test-1013b` két verzióval; minden teszt után üríti a tesztfiókot. Összesítő: `teljes/osszesito.txt`.
  A `leiras-seed` a címeket `details_checked_at`-tel veszi fel (a TMDB-frissítés ne írja át őket).
- Képernyőkép / videó a tesztfiókról: a fejléc e-mail-címét mintacímre kell cserélni
  (`munka/dizajn-2/eszkozok/mask.mjs`); videóhoz a Playwright ffmpeg-je a scratchpadbe kerül
  (`PLAYWRIGHT_BROWSERS_PATH`), lásd `munka/dizajn-2/eszkozok/video*.mjs`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
