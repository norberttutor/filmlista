# Filmlista – projektleírás Claude Code számára

## Kommunikáció
- A felhasználóval (Norbi) **magyarul** kommunikálj.
- Norbi SQL-ben és telefonos rendszerekben (Asterisk) jártas, a JavaScript/Next.js világ új neki.
  Röviden magyarázd el, mit és miért csinálsz, és a terminálparancsokat is írd le.
- Windowson dolgozik, VS Code-ban, a terminál alapprofilja Command Prompt (cmd).

## Mi ez?
Személyes webalkalmazás megnézendő filmek és sorozatok nyilvántartására: borítókép, műfajok, IMDb link, állapot
(megnézendő / folyamatban / megnézve / abbahagyva), letöltve jelző. Norbi a fő felhasználó; Mama saját, korlátozott
fiókkal Norbi filmjeit látja és jelöli. Az adatmodell felhasználónként elkülönít.

## Technológia
- **Next.js 16** (App Router), **JavaScript** (nem TypeScript), React 19
- **Supabase** (PostgreSQL + Auth + Realtime), `@supabase/supabase-js`, kliensoldali használat
- **Vercel** hosting, a GitHub `main` ág minden push-a után automatikus deploy
  - Repó: `norberttutor/filmlista` (privát); élő oldal: https://filmlista-six.vercel.app/
- **TMDB API** a film/sorozat adatokhoz (magyar nyelv: `language=hu-HU`)
- Stílus: sima CSS (nincs Tailwind), CSS változókkal; témakörönként az `app/styles/NN-<téma>.css` fájlokban, az
  `app/globals.css` csak `@import`-okkal sorolja fel őket. **A sorrend számít** (azonos erősségű szabályok közül a
  későbbi győz): új fájl a helyére kerüljön a listában, ne a végére.

## Környezeti változók
`.env.local` (helyben) és Vercel → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY` (publishable/anon kulcs, a böngészőbe kerül, RLS véd)
- `TMDB_READ_TOKEN` – **csak szerveroldalon**, soha ne kapjon `NEXT_PUBLIC_` előtagot
- `OMDB_API_KEY` – IMDb-értékelések (napi 1000 kérés), csak szerveroldalon; ha hiányzik, értékelés nélkül megy
- `APP_VERSION` – nem kell: Vercelen a commit (`VERCEL_GIT_COMMIT_SHA`), helyben `dev`; csak a teszt adja meg.

Csak helyben: `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`, `MAMATEST_USER_EMAIL` / `MAMATEST_USER_PASSWORD` (az értékeket
soha ne írd ki), `SUPABASE_DB_URL` (admin), `BACKUP_DB_URL` (csak olvasó `backup_reader`, `munka/e2e/mentes-olvaso.mjs`;
GitHub-titok is a heti mentéshez).

Soha ne használd a Supabase secret/service_role kulcsot a kliensben.

## Hol mi van
- **`munka/ROADMAP.md`** – hátralévő feladatok táblázatban, becsült idővel. Kész feladat után frissítsd.
- **`munka/terv-3/TERV.md`** – a „terv-3 NN” pontok: Norbi döntései, elvetett ötletek oka, látványterv-linkek; az új
  pont terve ide kerül (kész után csak a jövőt érintő döntés marad).
- Régi kódok (K/H/S/I/J, „#N”) oka: `git log --grep`.
- A `munka/` mappa helyi (git-ből kizárva), leírása: `munka/README.md`.
- **Ebbe a fájlba csak a mostani működés és a szabályok kerüljenek**, tömören – történet, dátumok, commit-hashek
  nem. A felület részleteit a kód mondja meg; ide az kerül, ami a kódból nem derül ki (döntés, csapda, összefüggés).

## Fájlszerkezet (csak a nem nyilvánvaló)

### Alap
- `app/layout.js` – betűk (`--font-main`; a téka Bungee / VT323-a `preload: false`), `lang="hu"`; a `<head>`-ben
  `THEME_BOOT_SCRIPT` (`lib/themeBoot.js`), ezért a `<html>`-en `suppressHydrationWarning`.
- `app/page.js` – kliensoldali session. A `list_viewers` saját sora alapján néző → `MamaView`, különben (hibánál is)
  `Watchlist`; a választ `localStorage` jegyzi (`filmlista-nezo:<userId>`). Net nélkül / lejárt tokennel / ha a
  `getSession()` nem válaszol (4 mp, net nélkül 0,3 mp) a tárolt munkamenettel (`storedSession()`, `offline: true`).
  `signOut()` (`lib/offline.js`) csak ezen az eszközön léptet ki (`scope: 'local'`, Norbi döntése); net nélkül /
  5 mp után helyben.
- Ikonok: mind a `munka/e2e/ikon.mjs`-ből; ikonváltozáskor ezzel generáld újra (ellenőrzés: `verify-ikon.mjs`).
- `app/manifest.js` – gyorsindítók `/?nyit=hozzaadas|franchise-ok|statisztika` (`SHORTCUTS` a `Watchlist`-ben).
- `app/error.js` + `app/sorrend/[token]/error.js` → `components/ErrorScreen.js`.
- `components/LoginForm.js` – regisztráció nincs (ki van kapcsolva).
- `components/SiteFooter.js` – kötelező TMDB forrásmegjelölés, ne töröld; a szponzor `span.sponsor`, nem `p` (a teszt
  egy bekezdést vár a láblécben).

### Téma
- `lib/theme.js` + `lib/themeBoot.js` (React nélküli – a szerverkomponens is használja) + `ThemeToggle`: sötét (alap),
  világos (`<html data-theme="light">`), téka. Választás felhasználónként (`filmlista-tema:<userId>`); alapból Mama
  világos, más sötét; a boot-szkript és a belépési oldal az utoljára használtat (`filmlista-tema`) veszi; a
  megosztott oldal a `prefers-color-scheme`-et. Teszt: `test-50.mjs`.
- **Videotéka-téma** (`'teka'`, csak Norbinál, ⋮ menüből). **Norbi feltétele: a sötét és a világos kinézet nem
  változhat** – minden téka-szabály `:root[data-theme='teka']`-val kezdődik (`03-teka-szinek.css`,
  `35-teka-felulet.css`), a téka elemei csak `useTheme() === 'teka'` mellett kerülnek a lapra (`lib/teka.js`).
  Ellenőrzés: `munka/terv-3/terv-d/osszevet.mjs` (HEAD vs új fordítás képpontosan, sötétben / világosban). Teszt:
  `test-d9-d10.mjs`.

### Fő lista – `components/Watchlist.js` + `components/list/`
- A `Watchlist` csak összeköt; a logika a `components/list/` hookjaiban (`useListData`, `useListFilters`,
  `listFilters`, `usePaging`, `useListChanges`, `useLiveTitles`, `backgroundRefresh`, `moreItems` …). Az ablakok egy
  állapotban (`dialog`, `openDialog`).
- **Betöltés**: `titles_with_genres` nézet (`loadTitles()`, `fetchAll`). Háttérfrissítés csak esedékes címnél
  (`lib/refreshDue.js`). Csendes újratöltés (`reloadKey`; szűrők / lapozás / adatlap marad): visszatéréskor,
  lehúzásra, élő szinkron újrakapcsolódásakor.
- **Offline / csak olvasható**: induláskor a helyben tárolt lista (`stale`), a friss a háttérben; minden változás
  1,5 mp után helyben is mentődik. `readOnly` (tárolt lista vagy nincs net): az írási menüpontok kimaradnak
  (`ONLINE_ONLY`), az adatlap mezői tiltva (`Lock`), minden írási hely elrejti / tiltja az írást.
  **Új írási gombnál a `readOnly`-t is kezeld** (a „Visszavonás” is). A fejléc „Cím hozzáadása” gombja tiltva marad
  a helyén (eltűnve a fejléc a friss listánál másként törne, a lista megugrana – teszt: `test-131.mjs`; a tesztek
  az írható listát az engedélyezett gombon ismerik fel). `main[data-list]`: `loading` | `stale` | `live` (a teszt
  erre vár).
- **Fejléc** (összecsukódó): `--head-h`, `--head-p` (0–1), `--head-c`; asztalon `main[data-head-away]`. Teszt:
  `test-1015.mjs`. **Neonfelirat** (`components/NeonBrand.js`): két cső egy sorban, egyforma méretben (Norbi kérése);
  munkamenetenként egyszer villan fel (`sessionStorage` `filmlista-neon`). **A neon él** (terv-3 132): 1–4
  percenként egy cső megrebben (`data-blip`) vagy az egész újra felkapcsol (`neon-on`, 1,6 s után lekerül); ≥ 5 perc
  távollét után és témaváltáskor is felkapcsol; rámutatásra rebben. Csak látható lapon, nyitott `<dialog>` nélkül;
  összecsukott fejlécnél a kis cím (`.top-compact[data-blip|data-on]`). Teszt: `test-132.mjs` (`page.clock`).
- **Szűrők alapállapota** (`DEFAULT_FILTERS`, Norbi kérése): Filmek – Megnézendő – Nem letöltött – Összes műfaj –
  Franchise nélkül. „Folyamatban” / „Abbahagyva” csak sorozatos típusnál (`MOVIE_HIDDEN_STATUSES`). Mama-szűrő
  sorozatnál / franchise-ra szűrve nem szűr (`mamaFilter`). Franchise választásakor a típus „all”, megszűnésekor
  vissza Filmek; az állapot „Mind” (`statusBeforeFranchise`). Asztalon (≥ 641 px) saját lenyílók (`FranchiseFilter`),
  telefonon natív `<select>`-ek. Teszt: `test-m3.mjs`.
- **Keresés**: `lib/listSearch.js` (`fold()`, `resolveWords` – elírás-tűrés), `components/Highlight.js`; gépeléskor a
  szűrők félreállnak (`SEARCH_FILTERS`). A mező (`searchInput`) azonnal frissül, a lista szűrése (`query` + a
  szűrőváltás együtt) `startTransition`-ben – a leütés nem vár rá. **A tesztek a lista keresőjébe írás után a
  `input.list-search[data-searched]` értékére várnak** (új tesztben is). Teszt: `test-1013.mjs`, `test-131.mjs`.
- **Rendezés** (`SORTS`): franchise-ra szűrve a nézési sorrend (`WATCH_ORDER`) vagy megjelenés (`FRANCHISE_SORT`);
  kézi rendezés után az marad. Nézési sorrendnél a lista tételekből áll (`{ key, title, item }`, sorozat évadonként).
- **Nézetek**: ≥ 1400 px-en lista (`TitleTable`) | rács (`localStorage` `filmlista-nezet`), alatta mindig rács.
- **`kept`**: a most szerkesztett sor a szűrés változásáig a helyén marad, akkor is, ha már nem illik a szűrőbe.
- **Törlés visszavonással** (`requestDelete`): azonnal lekerül, 8 mp „Visszavonás”; az adatbázisból csak lejáratkor
  / ×-re törlődik.
- **„Hogy tetszett?”**: táblázatból Megnézve-re váltott, értékelés nélküli címnél, csak a mentett sorra, egyszer; a
  szerkesztő ablakból nem.
- **Lapozás**: 25 (telefon / keskeny rács), 10 (asztali lista), 22 (asztali rács); asztalon a lapozó és a lábléc
  egy sávban (`docked`). A lapozás az oldal első címét jegyzi (`pageState.first`). Lapozáskor és induláskor
  (munkamenetenként egyszer, `filmlista-beuszas`) a kártyák / sorok beúsznak (`data-paging`). Teszt: `test-135-141.mjs`.
- **Letapadt szűrősor** (sticky, `data-stuck`, mögötte `ProgressiveBlur`): **a sáv és az ősei nem kaphatnak
  `backdrop-filter`-t, `filter`-t, `opacity`-t, maszkot** – különben a rétegek nem látnak át. A gyorsgombok
  (`.stuck-tools`) helye nyugalomban is foglalt (`data-off` → `visibility: hidden`), hogy a sor ne törjön másként.
  A fejléc felugrói a szűrősor (`z-index: 30`) fölött. Teszt: `test-102-103.mjs`.
- **Csúszó kijelölő** (`lib/useSlidingThumb.js`): új gombcsoportnál `className="… sliding"` +
  `ref={useSlidingThumb()}`; a kiválasztott közvetlen gyermek `aria-pressed` / `aria-selected`.
- **Animált átrendeződés**: `components/Reflow.js` – saját FLIP, **nem View Transitions** (az a letapadt szűrősor
  fölé rajzolna, és közben a lap nem kattintható). `data-flip="<kulcs>"`; a réteg (`.grid` / `.table-wrap`, Mama
  sorai, a „Nem érdekel”-es sorok) ezért `position: relative`; görgethető is lehet. `exit(kulcs)`: a kieső tétel
  saját mozgása (`HIDE_EXIT`; Mamánál balra kiúszik). Teszt: `test-49-3.mjs`, `test-133-137.mjs`.

### A lista elemei
- `components/PosterCard.js` (kártya, w342), `components/TitleTable.js` (asztali lista, w185, `table-layout: fixed`).
  Mama-oszlop / -jelölés csak `mamaApplies(t)` esetén. Az üres lenyílók és a kuka csak rámutatva (`@media (hover:
  hover)`). Mentés: `saveRow`. Megjegyzés mező nincs a felületen (a `notes` oszlop megmaradt). Teszt: `test-84.mjs`.
  Megnézettre váltáskor kihúzás + a borító színe kifolyik (`lib/useStrike.js`: `useStrike`, `useDrain`, `.drain-copy`);
  nyitott ablaknál a bezárásáig vár (a kártya az adatlap mögött van).
- `components/ImdbBadge.js` – IMDb-jelvény és `CriticBadges` (RT / MC). A szám a skála színével (`data-score`,
  `--score` 0–100, 12-boritofal.css; tokenek `--score-l` / `--score-c`). **Az RT / MC csak az adatlapon és az asztali
  listán** – a kártyán és Mamánál csak az IMDb (Norbi döntése). A toplista jelvénye nem színes. Teszt: `test-127.mjs`.
- `components/Seasons.js` – évadok (`hasSeasons`, `useSeasonActions`, `SeasonStrip`, `SeasonList`, `SeasonTimeline`
  …). „Abbahagyva”: kézi, az évadjelölés és az új évad sem írja felül; a „Mind megnézve” feloldja. A TMDB-n is szereplő
  törölt évadot a heti frissítés visszahozza. Epizódszintű követés nem kell.
- `components/ReleaseBadge.js` – Hamarosan / Moziban / új évad. Szűrőgomb nem kell (Norbi döntése).
- `lib/genreColors.js` (`genreColor(név)`, a kulcs a TMDB magyar műfajneve), `components/GenreIcon.js`.
- `components/FranchiseFilter.js` – saját listbox (franchise, és asztalon a szűrősor többi lenyílója is); a
  felolvasónak „Név, 2 hátra” (a teszt `frOption()`-ja erre épít). **A `.grid` osztálynév foglalt** (borítórács) – a
  rácsos panelé `.ff-grid`. Nyitva Vissza-réteg (`useBackLayer`).
- `components/FranchiseSelect.js` – `.franchise-new` módban az adatlap nem zár kikattintásra.
- `components/StarRating.js` – billentyűzettel a nyíl csak előnézet, Enter / Szóköz ment; a kiválasztottra újra
  kattintva `null`.
- `components/Toaster.js` + `lib/toast.js` – `toast({ text, image, content, action, hideClose, duration = 8000,
  onExpire, kind })`, `dismissToast`; az `onExpire` lejáratkor és ×-re fut (az action-re nem); legfeljebb 3;
  `duration: null` nem jár le. **Nyitott `<dialog>` fölött a sáv nem kattintható** – ablakon belül helyi
  visszajelzés kell.

### Adatlap – `components/TitleEditor.js`
- Natív `<dialog>`, **lapokat tart** (`stack`: `{ id, rowId, item, added }` vagy `{ id, person }`), mindig az utolsó
  látszik. Ha a cím nincs a listán: **előnézet** (`TitlePage preview`) „Hozzáadás a listához” / „Már láttam”; felvétel
  után helyben rendes adatlap, nem zárul be. Előnézet a keresőből, Felfedezésből, Hasonló címekből, harangból; a
  franchise-gyűjteményből és az importokból nem.
- Az elöl lévő lap `apiRef`-en adja a `canLeave`-et. Megnyitáskor a fókusz a címen (`id="editor-title"` csak a
  látható lapé). A rejtett lapon nem szól az előzetes.
- **Azonnali mentés**: minden mező kattintásra ment (`save()` → `saveRow`), nincs Mentés / Mégse; `.saved-note`
  visszavonással (10 mp). A törölt franchise üresre állítása nem mentendő (`deleted` ref).
- A `watched_at` nem látszik (megnézettre állításkor a mai nap). „Abbahagyva” csak sorozatnál.
- Moziszerű fejléc jelenetképes lapon asztalon (`WIDE_QUERY`, `.editor-page.has-hero`, `data-frozen`). Teszt:
  `test-104.mjs`.
- Adatsor (`.meta`, Norbi választása – „D”): év · Film / Sorozat · sorozatnál az állapot szavakkal
  (`seriesStatusText`) · játékidő (`formatRuntime`; sorozatnál a legutóbbi rész) · IMDb. Korhatár nincs (elvetve).
  Mamánál csak a játékidő. Teszt: `test-125.mjs`.
- **Bezárás**: „Bezárás” (`DialogClose`, asztalon), Esc, kikattintás asztalon, Vissza gomb (`backHandler`).
  `closedby="none"` (Android – lásd `lib/backClose.js`). Telefonon alsó lap fogantyúval (`DialogClose`), nincs gomb.
- **Nézetváltás** (`lib/viewTransition.js`): a borító átsiklik az adatlapra, ezért a `showModal()`
  `useLayoutEffect`-ben fut. Csak az első lapról siklik vissza, törléskor nem.
- Hangulatszín: az ablak saját háttere, nem `::before` réteg (az görgetéskor felgördült).
- Részei: `TopCast` + `/api/tmdb/credits` (`CREDITS_V`), `PersonPage` + `/api/tmdb/person` (`PERSON_V`, közös
  forrás `lib/server/people.js`; teszt: `test-61.mjs`, `test-m4.mjs`), `TitleGallery` (az Esc a window rögzítő
  fázisában; teszt: `test-95.mjs`), `WatchProviders` (csak HU `flatrate` + `free` + `ads`; kötelező „Forrás:
  JustWatch” – TMDB-feltétel), `SimilarTitles` (`SIMILAR_V`), `Trailer` (`youtube-nocookie.com`). A később érkező
  részek első megjelenéskor beúsznak: `lib/useArrival.js` (`data-arrive` ~1 s-ig – a visszajövő rejtett lapon nem ismétlődik).

### Felfedezés, kereső
- `components/TitleSearch.js` – 400 ms késleltetett TMDB-keresés; színészek / rendezők is (≤ 6, a személy lapja a
  `TitleEditor` első lapjaként). A mező felirata „Film vagy sorozat címe – vagy színész, rendező” (**az eleje a
  tesztek kapaszkodója**). A mező `focus({ preventScroll: true })`-t kap, **nem `autoFocus`-t** (az megszakítaná az
  `openAdd` lap tetejére görgetését). Teszt: `test-110-111.mjs`.
- `components/Discover.js` + `lib/server/discover.js` – **Norbit csak a magyar szinkronos címek érdeklik** –
  közelítés: film = HU megjelenés (`region=HU`, release type 2|3 vagy 4), sorozat = HU előfizetéses streaming, 90
  napon belüli rész; angol vagy magyar eredeti, van magyar leírás; nincs dokumentum / valóságshow / talkshow / hírek /
  szappanopera / **animáció**. A böngésző a **megnyitáskor már listán lévőket** és az elrejtetteket kihagyja. Kliens
  `DISCOVER_V` – **a válasz változásakor emeld**. A Hasonló címek és a kereső nem szűr így. A `.discover` oszlopa
  `minmax(0, 1fr)` (különben telefonon az egész lap kicsinyedik). Teszt: `test-m2.mjs`.
- `components/FeaturedBand.js` (kiemelt sáv, hibánál elmarad), „Neked ajánlott” (8+ értékelésűek alapján; a magyar
  megjelenést itt nem szűri). Lapozáskor áttűnik: a régi kép másolata (`.featured-bg-old`) alatta, a kép és a szöveg
  címenként új elem (**külön kulcs – `kep:` / `szoveg:`; azonos kulcsnál a régiek a lapon maradtak**).
- `lib/hiddenSuggestions.js` + `components/HideSuggestion.js` – „Nem érdekel”; a Felfedezés és a Hasonló címek szűri,
  a keresés nem. Elrejtéskor a sor többi tagja odacsúszik (`Reflow`, a trigger a kulcsok sora).
- Felvételkor (`lib/flyPoster.js`, 134): a „Cím hozzáadása” panelen a borító a fejléc számához (`.count-n`;
  összecsukva a kis címhez) repül, a szám dobban (`bump`); a „✓ A listán” mindenhol `components/OnList.js` – a most
  felvettnél (`justAdded`, az `addTitle` jegyzi) a pipa megrajzolódik. **Új „✓ A listán” helynél ezt használd** (a
  tesztek a „✓ A listán” szöveget keresik – a pipa egy `.tick` span).

### Franchise-ok
- `components/FranchisesDialog.js` – ábécérend **névelő nélkül** („A” / „Az” / „The” nem számít). Csempére kattintva
  `CollectionDialog` az ablakon belül (teszt: `test-h9.mjs`). Szerkesztés / megerősítés közben az Esc és a Vissza
  csak azt zárja. TMDB-hibánál nem „nincs TMDB-gyűjtemény”, hanem újrapróbálás (`loadFailed` / `onRetry`).
- `components/FranchiseSuggestions.js` + `lib/franchiseSuggest.js` – **csak felajánlja**, magától soha nem rendel
  hozzá, a meglévőt nem írja át; nyitott `<dialog>` alatt a bezárásáig vár.
- `components/FranchiseCollection.js` – franchise-sáv és `CollectionDialog` (Gyűjtemény / Nézési sorrend fül);
  felvételkor az ablak nyitva marad. Teszt: `test-hozzarendeles.mjs`, `test-audit-6.mjs`.
- `components/FranchiseActions.js` – logóválasztó (`logo_path: ''` = „Csak a név”). **Mentés közben a gombok nem
  tiltódnak** (a fókusz a body-ra esne, és az Esc az egész ablakot zárná). Teszt: `test-j8.mjs`.
- `/api/franchises/logos` – automatikus logó csak `logo_path is null`-nál; a kézzel választottat (`''`-t is) nem
  írja felül.
- `components/WatchOrder.js` + `lib/watchOrder.js` – nézési sorrend (kulcs `címId:évad`, 0 = film); „Kész” →
  `set_franchise_order` RPC.
- `components/ShareOrder.js` + `lib/shares.js` + `app/sorrend/[token]/` – megosztott sorrend: szerverkomponens
  (`connection()`, nem indexelt), állapot / értékelés / letöltve / Mama nem látszik; hibás link 404; a service
  worker nem kezeli. Teszt: `test-41.mjs`, `test-20.mjs`.

### Színészek és rendezők
- `lib/people.js` – követések tárolója (`useFollowed`, `followPerson` – követéskor rögtön `refreshPeople`, az első
  ellenőrzés csak megjegyez; `personSummary`).
- `components/PeopleDialog.js` – asztalon portrérács, telefonon vízszintes csempék (Norbi választása, csak a CSS
  más); az Esc / Vissza az idővonalról a csempékhez lép. Teszt: `test-m4.mjs`.
- `components/FollowSuggestions.js` + `/api/people/suggest` – „Kit érdemes követned?”; elrejtés `localStorage`-ban.
  Kliens `SUGGEST_V` – **a válasz változásakor emeld**.

### Toplisták
- `components/ToplistsDialog.js` + `lib/server/toplists.js` – minden osztálya `toplist-` előtagú (**a `.top-*` a
  fejlécé, a `.tl-*` az évad-idővonalé – mindkettő ütközött már**). Kliens `TOPLIST_V` – **a válasz változásakor
  emeld**. Teszt: `test-120.mjs`.
- Szűrés (Norbi döntése, „laza” – `huOk()`): film – angol / magyar eredetinél HU megjelenés vagy bármilyen HU
  szolgáltató, más nyelvűnél csak HU megjelenés; sorozat – HU streaming; magyar leírás kell; dokumentum / hírek /
  valóságshow / szappanopera / talkshow / koncertfilm nincs, **az animáció benne van**. IMDb-értékelés: `imdb_ratings`
  (30 nap) → saját lista → OMDb, napi keret 400 (`DAILY_OMDB`). Súlyozott IMDb-sorrend, ≤ 250 tárolva (`toplists`, 7
  nap; hiányos lista másnap újraépül). Első összeállítás 10–30 mp (`maxDuration = 60`).

### Egyéb ablakok és menük
- `components/MoreMenu.js` – ⋮ menü, pontok `{ id, label, description, icon, onSelect }`.
- `components/NotificationBell.js` + `lib/notifications.js` – `loadNotifications()` előbb lefuttatja a
  `collect_season_notifications()` / `collect_release_notifications()`-t; olvasottra csak azonosító szerint; törlés
  `dismissed_at`. A `mama_interested` csak akkor látszik, ha a `mama_status` most is „Érdekli” / „Megkapta”.
- `lib/popupSide.js` + `lib/usePhonePopup.js` – telefonon portálon a `body`-ba (a fejléc gombsorának transzformja a
  `position: fixed` listát különben a gombsorhoz igazítaná).
- `components/StatsDialog.js` + `lib/stats.js`; `components/BackupsDialog.js` + `lib/backups.js`.
- `lib/errorLog.js` + `components/ErrorsDialog.js` – hibanapló: **a kliensoldali `console.error(error)` helyett
  `reportError(error)`** (konzolra is ír, `log_client_error` RPC; a hálózati hibát, megszakítást, böngészőzajt
  kihagyja). Teszt: `test-113.mjs`.
- `components/PasswordDialog.js` – a jelenlegi jelszót egy **külön, nem tároló Supabase-kliens** ellenőrzi
  (`persistSession: false`, saját `storageKey`, utána `signOut({ scope: 'local' })`); hibakódok: `lib/authErrors.js`.
  Elfelejtett jelszó nincs. Teszt: `test-27.mjs` (a tesztfiók jelszavát a végén mindenképp visszaállítja).
- `components/ManualDialog.js` + `scripts/leiras.mjs` – a `FELHASZNALOI-LEIRAS.md`-ből a `npm run dev` / `build`
  elején készül a `public/leiras/` (git-ből kizárva). Teszt: `test-48.mjs`.
- `components/BulkImport.js` + `lib/bulkImport.js` (csak asztalon), `components/ImdbRatingsImport.js` +
  `lib/imdbImport.js` (az IMDb csillaga felülírja a sajátot, új cím nem kerül fel). Bezárás után a futás a háttérben
  végigfut (`runRef`). Automatikus IMDb-szinkron nincs (nincs API, a gépi olvasás tiltott).
- `lib/exportList.js` – CSV (UTF-8 BOM, pontosvessző, tizedesvessző – Excelhez).

### Mama
- `components/MamaView.js` + `components/MamaDetail.js` – fülek „Filmek” / „Érdekel”; optimista `mama_mark()`
  (címenként sorba állítva). Helyben nem tárol. Visszatéréskor `useAppFreshness`. E2e: „Mama oldala (terv-3 13)…” a
  Mama-tesztfiókkal. Jelöléskor / visszavonáskor a sorok a `Reflow`-val mozognak (`moves` a trigger – fülváltáskor
  nem), „Érdekel”-re a borító a fül számához repül (`flyPoster`).

### Közös könyvtárak
- `lib/supabase.js` – kliens. `lib/api.js` – `apiGet()`: saját `/api` route Bearer tokennel.
- `lib/titles.js` – címműveletek (a `titles_with_genres` friss sorát adják vissza): `addTitle(item, details?, {
  watched, franchise_id })`, `updateTitle`, `deleteTitle`, franchise- és évadműveletek, háttérfrissítők (utolsó
  paraméter `isCancelled`), `releaseState(t)` (mozis bemutató után 120 napig moziban), `releaseKey`, `mamaApplies`,
  `todayDate()` (budapesti idő). **`DETAILS_V`, `CREDITS_V`, `SIMILAR_V`: a válasz mezőinek / szűrésének
  változásakor emeld**; a kérők mind innen veszik. A franchise nevét a kliens keresi ki (nincs a nézetben).
- `lib/rowSaves.js` – `saveRow(sor, apply, kérés, show)`: soronként sorba állított optimista mentés.
  `hasPendingSave`, `isOptimistic(row)` (mellékhatást csak mentett sorra). **Új optimista mentésnél ezt használd.**
  Teszt: `test-audit-9.mjs`.
- `lib/fetchAll.js` – a PostgREST kérésenként legfeljebb **1000 sort** ad. **Új, a teljes listát lekérő
  lekérdezésnél ezt használd** (egyértelmű rendezéssel).
- `lib/refreshDue.js` – esedékességi szabályok. **A route-ok ugyanezt kérdezik (részben SQL-ben) – változtatáskor
  mindkét helyen.**
- `lib/posterColor.js` – `usePosterColor`: hangulatszín a w92-es borítóból, **saját gyorsítótár-kulccsal (`?szin`)**
  (a CORS nélkül tárolt kép a vásznat tiltaná). `ambientProps`, `franchisePosterPath`.
- `lib/viewTransition.js` – `afterTransition()`: **a szerkesztő megnyitásakor érkező új, nem sürgős
  állapotfrissítést ezzel késleltesd** (terhelt gépen akadást okozott).
- `lib/afterDialogs.js` – `afterDialogs(fn)`: ha már nincs nyitott `<dialog>` (a „close” nélkül, nyitva eltávolított
  ablakot is észreveszi – DOM-figyelő); `useAppearance(on)`: a jelölés
  megjelenésének mozgása az adatlap bezárásakor (`'wait'` → `'play'`; a kártyán az adatlap mögött nem látszana –
  így a „Letöltve” jelvény, 141 a; a kihúzás is erre vár, 133).
- `lib/useBackdropClose.js` – `useBackdropClose(dialogRef, { onClose, canClose, onBlocked })`: kikattintásra zár
  (asztalon), ha nem zárhat, `nudgeDialog()`. Nem zár: adatlap (megerősítés / név gépelése / felvétel; net nélkül zár), Színészek
  és rendezők és Toplisták (felvétel), Franchise-ok (szerkesztés, megerősítés, nyitott gyűjtemény-ablak),
  gyűjtemény-ablak (felvétel, sorrend-szerkesztés, megerősítés, fejléc szerkesztése), Mentések, Hibák (megerősítés /
  törlés), Jelszó (beírt jelszó / mentés); Statisztika és Leírás mindig zár; **az importablakok soha** (Norbi döntése).
- `components/DialogClose.js` – egységes bezárás (Norbi döntése): **minden ablak `<dialog>`-jának első gyermeke**.
  Asztalon „Bezárás” jobbra fent, ragadós; telefonon fogantyú (`.sheet-handle`, `lib/useSheetDrag.js`), lehúzva zár,
  és az ablak ettől alsó lap (`dialog.editor:has(> .dialog-close-bar)`, `39-adatlap-elrendezes.css`). Mindkettő
  ugyanazzal a szabállyal, mint a kikattintás (`const closing = { onClose, canClose }`, a `useBackdropClose` is ezt
  kapja; nem zárhat → megbillen, a lap visszaugrik). Az ablak alján nincs „Bezárás” (a művelethez tartozó „Mégse”
  marad). Helye: `--close-top` / `--close-right`, a fejléc helyet hagy neki (`27-adatlap.css`). **Ablak `> div`
  szabálya: `> div:not(.dialog-close-bar)`.** Kivétel: Mama adatlapja (×, saját fogantyú). Teszt: `test-121.mjs`.
- `lib/backClose.js` – a Vissza gomb a legfelső réteget zárja (rétegenként `history.pushState`). A modális
  `<dialog>`-okat MutationObserver kezeli – **új ablakhoz nem kell semmi**; saját szabály: `dialog.backHandler` →
  'stay' | 'stepped' | 'closing'; nem dialog réteg: `useBackLayer(open, close)`. **Android**: nyitott modális
  ablaknál a vissza-gesztus `cancel`-ként jut az ablakhoz, ezért az adatlap `closedby="none"`, az Esc-et `keydown`
  kezeli; az adatlap lapjai saját bejegyzést kapnak (`pushDialogPage` / `popDialogPage`). **A bejegyzések
  `scrollRestoration = 'manual'`-lal** (`pushOwn`; a beállítás bejegyzésenként tárolódik, a cél bejegyzésé számít) –
  különben a réteg bezárásakor a lap a nyitásakori helyre ugrana. Teszt: `test-1013b.mjs`, `test-gesztus.mjs`,
  `test-atnezes-f.mjs`.
- `lib/appVersion.js` + `/api/version` – `useAppFreshness` (≥ 5 perc rejtés után csendes újratöltés; új buildnél
  „Frissült az app” sáv).
- `lib/prefetch.js` – rámutatásra előtöltés **ugyanazzal az URL-lel, mint a `TitleEditor` – ha ott a paraméterek
  változnak, itt is**.
- `components/PullRefresh.js` – csak érintéssel, a telepített appban. Teszt: `test-1014.mjs`.
- `lib/liveSync.js` – Supabase Realtime; feliratkozásonként új csatornanév; a törlésről csak a kulcs jön. A
  `useLiveTitles` a saját visszhangot, a függő mentésű és függő törlésű címet kihagyja.
- `public/sw.js` + `lib/offline.js` – service worker (csak kiadott változatban): az `/api` és a Supabase nem
  tárolódik. A borítótároló (`POSTERS`) a tárolt listából dönti el, mi tartozik ide: `LIST_SIZES` w342 / w185 – **a
  `PosterCard` / `TitleTable` / `FranchiseFilter` képméretének változásakor itt is**. **A tárolás módjának
  változásakor emeld a `VERSION`-t.** Minden válasz a `respond()`-on át: ha a tároló hibát dob (már a `caches.open`
  is – sérült profil, betelt lemez), a hálózatról; a tárolóba írás hibája nem buktathatja el a választ. Lista:
  IndexedDB (`loadSnapshot` / `saveSnapshot` / `clearSnapshots`). Teszt: `test-44.mjs`, `test-131.mjs`.

### Szerveroldal
- Minden `lib/server/` modul `import 'server-only'`-val kezdődik (újba is tedd bele).
- `lib/server/auth.js` – `getUserFromRequest()` (a tokent helyben, `getClaims()`-szel ellenőrzi), `supabaseAsUser()`;
  az `/api/tmdb/*` token nélkül 401.
- `lib/server/tmdb.js` – `tmdbFetch()` (10 mp), `titleParams(request)`, `cachedResponse(body, mp)` – **hibás vagy
  részben hiányos válasz soha nem tárolható** (ilyenkor sima `Response.json`), `cached(kulcs, ms, betöltő, keep?)`
  (memória), `pickReleaseDates`, `pickSeasons`, `pickOverview`, `pickFacts` (runtime, series_status – a `details`,
  `seasons`, `details-refresh` közös forrása), `ANIMATION_GENRE`.
- Lekérő route-ok: `app/api/tmdb/…` (GET). Ha a cím már nincs a TMDB-n: üres / null. A `details`-ben az OMDb hibája
  nem akadályozza a felvételt. `similar`: ≥ 2000, TMDB ≥ 6,0, ≥ 50 szavazat, animáció nélkül.
- Háttérfrissítő `POST` route-ok (a felhasználó jogaival, kötegekben, a `Watchlist` hívja betöltéskor):
  `imdb/refresh` (az `rt_rating` / `mc_rating` is), `tmdb/seasons` (az állapothoz nem nyúl; a `series_status` / `runtime` itt frissül, a megnézett
  sorozatoknál is), `tmdb/backdrops`, `tmdb/releases`,
  `tmdb/title-collections`, `tmdb/collection-parts`, `tmdb/details-refresh`, `franchises/logos`, `people/refresh`.
  Szabályok: az értesítést írók (`collection-parts`, `people/refresh`) **előbb az értesítést írják, utána az
  ismerteket**, és első ellenőrzéskor csak megjegyeznek; le nem tölthető gyűjteményt nem jelölnek ellenőrzöttnek. A
  `details-refresh` a címet **csak akkor** cseréli a magyarra, ha most az eredeti áll ott (a kézzel adottak maradnak),
  a saját adatokhoz nem nyúl.
- `app/api/keepalive` + `vercel.json` – napi cron, a Supabase ingyenes projekt ébren tartása.
- `.github/workflows/mentes.yml` – heti külső mentés (`BACKUP_DB_URL`), 8 napnál régebbi mentésnél hibával áll le.
  Visszatöltés: `munka/e2e/mentes-feltoltes.mjs <fájl.json> <e-mail>`. A `backup_reader` jelszavának cseréje:
  `mentes-olvaso.mjs`, utána a GitHub-titok is.

### Dokumentáció
- `supabase/*.sql` – a már lefuttatott adatbázis-szkriptek (számozva).
- `FELHASZNALOI-LEIRAS.md` – felhasználói leírás (képek: `docs/kepek/*.jpg`, `munka/terv-3/33-leiras/leiras-seed.mjs`
  + `leiras-kepek.mjs <név>`); frissítése: Konvenciók → „Felhasználói leírás”.

## Adatbázis (részletek: `supabase/`)
- `genres (id = TMDB műfaj ID)`. `statuses`: `to_watch`, `watching`, `watched`, `dropped` (a felület csak sorozatnál
  kínálja). Új állapotnál szín és CSS is kell (Konvenciók).
- `titles` – `user_id` (default `auth.uid()`), `media_type`, `tmdb_id`, `imdb_id`, `status`, `is_downloaded`,
  `mama_status` (null | 'interested' | 'declined' | 'received'), `franchise_id` (on delete set null), `my_rating`
  (1–10), `notes`, `watched_at`, `release_date` (sorozatnál `first_air_date`), `runtime` (perc; sorozatnál a
  legutóbbi részé – a TMDB `episode_run_time` szinte mindig üres), `series_status` (a TMDB `status` szövege, a
  kliens fordítja; `pickFacts()`), `rt_rating` / `mc_rating` (0–100, az OMDb `Ratings` tömbjéből; sorozatnál
  gyakran nincs), …, ellenőrzési időbélyegek (`*_checked_at`). Egyedi `(user_id, media_type,
  tmdb_id)`.
- Trigger: „Megnézve”-re váltáskor az `is_downloaded` hamis lesz (utána kézzel bejelölhető); a felület is leveszi.
- `title_seasons` (PK `(title_id, season_number)`). Triggerek: a sorozat `status` / `is_downloaded` / `watched_at` az
  évadokból számolódik (`seasons_summary`): minden megjelent évad megnézve → `watched`; van megkezdett → `watching`;
  különben `to_watch`; a bejelentett évad nem számít. Kivétel a `dropped` (kézi). Évados sorozat `status`-ának
  közvetlen írásakor a `dropped` kivételével mindig az évadokból számolt érték kerül be. Évadok nélkül a cím kézi.
- `franchises` (`logo_path`: null = még nincs, `''` = „Csak a név”; `tmdb_collection_ids` NULL is lehet – üresnek
  veendő); egyedi `(user_id, lower(name))`.
- `franchise_order` (`season_number` 0 = film); `set_franchise_order(franchise, items)` egy tranzakcióban. Trigger:
  más franchise-ba került cím kikerül a régi sorrendből.
- `franchise_collection_parts`, `followed_person_credits`: ismert részek / filmek (ebből derül ki, mi új); nincsenek
  a mentésben.
- `hidden_suggestions`, `followed_people` (PK `(user_id, person_id, role)`).
- `notifications` – `kind`: 'season_announced' | 'season_aired' | 'movie_digital' | 'mama_interested' |
  'collection_new' | 'person_new' (az utóbbi kettőnél `title_id` üres). A törölt (`dismissed_at`) sor megmarad, így
  a gyűjtők nem írják újra.
- `backups` – `backup_snapshot(user)` version 4; a régebbi verziókból hiányzó táblák visszaállításkor nem változnak.
  Írni csak a függvények (`write_backup`, `create_my_backup`, `restore_my_backup` – előbb `before_restore` mentés);
  pg_cron hétfőn. **Visszaállítás alatt `set_config('filmlista.restoring', 'on', true)`**: a
  `clear_downloaded_when_watched`, `title_seasons_before_write`, `sync_title_from_seasons` trigger ilyenkor nem
  módosít – ha ezeket módosítod, a jelző-vizsgálat maradjon az elejükön. A `session_replication_role` itt nem
  állítható.
- `franchise_shares` (token; visszavonás = törlés), `shared_watch_order(token)` (security definer, `anon` is):
  állapot, értékelés, letöltve, Mama, megjegyzés, user_id soha.
- `list_viewers (viewer_id → owner_id)`: írni csak SQL-ből (`munka/e2e/mama-kapcsolas.mjs`). `mama_list()`,
  `mama_mark()` (security definer; Mama a `titles` táblát közvetlenül nem látja). **`title_released(t)` a
  `releaseState()` szabálya SQL-ben – ha az egyik változik, a másikat is.** Teszt: `test-17.mjs` (`--live`).
- `client_errors` – írni csak a `log_client_error()`; Mamánál a gazda naplójába kerül. A `clearTestAccount()` üríti.
- `imdb_ratings`, `toplists`: **közös** (nem felhasználói) gyorsítótár; írni csak a `store_*` függvények. A közös táblákat (`genres` is) a
  néző (`list_viewers`) nem írhatja.
- `titles_with_genres` nézet (`security_invoker`): `titles.*` + `status_name` + `genres` + `seasons`.
- Realtime: `titles`, `title_seasons`, `notifications`, `franchises`.
- Nincs a mentésben: `franchise_shares`, `list_viewers`, `client_errors`, `imdb_ratings`, `toplists`,
  `franchise_collection_parts`, `followed_person_credits`.
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
- Felületi szövegek magyarul, mondatkezdő nagybetűvel, cselekvő igékkel (pl. „Hozzáadás a listához”, nem „Submit”).
  A hibaüzenet mondja meg, mi a baj és mit tegyen a felhasználó.
- Az alapállapot (`to_watch`, `DEFAULT_STATUS`) a felületen **üresen** jelenik meg (nincs felirat, nincs szín; csak a
  szűrőgomb nevezi meg). Az adatlapon a kiválasztott állapotra / Mamára újra kattintva üres lesz.
- A megnézett és az abbahagyott címek háttérbe húzódnak: fekete-fehér, fakó borító, tompított, de olvasható szöveg
  (`--watched-text`, ≥ 4,5:1) – nem az egész sor átlátszó. Rámutatáskor és fókusznál teljes színű.
- **Két téma**: a sötét az alap (`:root`), a világos az `app/styles/02-vilagos.css`-ben. **Új színtokennél a
  világosba is kell érték**, és a kontrasztot mérd (`munka/terv-3/terv-50/kontraszt.mjs`, `VEGLEGES=1`). **Beégetett
  színt ne használj**: fátyol `rgb(var(--tint) / 0.05)`, árnyék `rgb(var(--shade) / calc(0.6 * var(--shade-k)))`,
  üveg `rgb(var(--glass) / 0.8)`, `::backdrop` `rgb(var(--scrim) / calc(0.62 * var(--scrim-k)))`; teli piros gomb
  felirata `--danger-ink`.
- **A film / franchise színe (`--ambient`)**: keverési arány `min(100%, calc(N% * var(--ambient-k)))`, teli színű
  vonal / ikon `var(--ambient-ink)`; a mezőcímke (`--ambient-label`) és a `::backdrop` kivétel. **Új `--ambient`-es
  szabálynál is így.**
- **Sötét szigetek**: a képes sávok világosban is sötétek (`.featured-slide`, `.featured-sk`,
  `.collection-banner[data-backdrop]`, `.share-hero[data-backdrop]`, `.fr-logo`, galéria) – a sötét tokeneket a
  `:root` szabály kiválasztója adja nekik (a P3-asé is). Új képes sávnál ide is fel kell venni.
- Színek: `--accent` neon türkiz (a „Folyamatban” is); állapotszínek `--st-<kód>`. Új állapotnál szín és
  `[data-status=...]` szabály is kell (kártya és sor).
- `--accent-2` (borostyán): **csak a saját jelöléseken** (saját értékelés, Mama, harang száma, Statisztika
  értékelés-csempéi). Soha nem gombszín; a türkiz marad a gomboké, állapotoké, kiválasztott szűrőké, fókuszkereté.
- Tartalomfajták színei: `--c-coral` mozi, `--c-indigo` bejelentett / hamarosan (a még meg nem jelent évad / rész
  mindenhol indigó szaggatott, `data-upcoming`), `--c-sky` digitális / letöltve, `--c-sage` megjelent, `--c-rose`
  ajánlás. Mindig ugyanazt jelentik, **soha nem gombszínek**; teljes erővel csak apró jelölésen.
- Értékelés-skála (IMDb / RT / MC száma): 40 alatt piros, 60-nál sárga (zöldes, nem borostyán), 80-tól zöld; csak a
  számon, soha nem gombon / állapoton.
- Színtokenek OKLCH-ban (mellettük megjegyzésben a hex; hexből: `munka/dizajn-2/eszkozok/oklch.mjs`); P3-on
  élénkebb `--accent` / `--accent-2`. A build hex / `lab()` tartalékot generál, ezért a teszt a színeket vásznon át,
  sRGB-ben hasonlítja (`rgbOf`).
- Teli türkiz csak a fő műveleteknél (Cím hozzáadása, Hozzáadás a listához, Belépés); a kiválasztott állapot
  `--accent-soft` háttér + `--accent-line` keret. Gombok kerek végűek, rámutatva világosodnak, lenyomva sötétednek.
- Saját lenyíló-nyíl (`--chevron`) és jelölőnégyzet (`--check-mark`); ahol egy szabály `background` rövidítést ad egy
  lenyílónak, a nyilat is újra meg kell adni. A natív `<select>` `appearance: base-select`-tel (`@supports` mögött);
  a telefonos szűrő-opciók előtt ikon (`--opt-icon`) / szín (`--opt-dot`) – **új opciókódnál ide is kell ikon, és
  asztalra a `components/FilterIcons.js`-be is**.
- **Mozgás**: legfeljebb ~0,2 s-os átmenetek; kivételek az `app/styles/36-mozgas.css`-ben, valamint helyben,
  megjegyzéssel, a saját blokkjukban: az aurora-háttér (`04-alap.css`), a telefonos alsó lap felcsúszása
  (`39-adatlap-elrendezes.css`, `44-mama.css`) és a csúszó kijelölő (`45-csuszo.css`). Új kivétel a 36-osba kerüljön.
  A `46-kevesebb-mozgas.css` `prefers-reduced-motion` szabálya mindent kikapcsol; a JS-ből indított mozgások
  (`Reflow`, `viewSwitch`, nézetváltás) maguk nézik.
- Görgetősáv: saját (`::-webkit-scrollbar`). Elemre ne adj `scrollbar-width` / `scrollbar-color`-t (Chrome-ban akkor
  a `::-webkit-scrollbar` nem érvényes).
- „Squircle” sarkok (`corner-shape: squircle`, `@supports` mögött): borító 22 px, kis borító 13 px, szerkesztő ablak
  32 px, panelek 20 px, mezők 12 px; új lekerekített elemnél (és a `::before` / `::after` keretnek) is kell. A
  pirula alakú (kerek végű) elemek és a körök kivételek. A `34-squircle.css` után jövő fájlok elemeinél a szabály
  helyben áll (különben a későbbi `border-radius` felülírja).
- Új dizájnötletnél: előbb látványterv / előtte–utána képek (`munka/dizajn-2/eszkozok/`), beépítés csak Norbi
  jóváhagyása után.
- **Új ablaknál (`<dialog>`) mindig vizsgáld a kikattintásos bezárást** (`useBackdropClose`, `canClose`; a
  `DialogClose` ugyanígy): mikor ne
  zárjon (bevitel / szerkesztés / megerősítés / folyamatban lévő művelet). Ha szándékosan nem zár, írd oda
  megjegyzésben és ide. Ha egy másik `<dialog>`-on belül nyílik a React-fában, a külső `onClose` csak a sajátjára
  zárjon (`e.target === e.currentTarget`) – a React a belső „close” eseményét is továbbítja.
- Képekhez sima `<img>`, nem `next/image`. Nincs middleware / proxy; az auth kliensoldali.
- **Felhasználói leírás** (`FELHASZNALOI-LEIRAS.md`): **időszakosan frissül, nem minden fejlesztés után**; a
  fejlesztés commitjában ne nyúlj hozzá. Frissítés Norbi kérésére: a leírás utolsó commitja óta készült változások
  (`git log $(git log -1 --format=%H -- FELHASZNALOI-LEIRAS.md)..HEAD`) alapján a szakaszok, a változott felület képei
  (`leiras-seed.mjs`, majd `leiras-kepek.mjs <név>`; a jelölők és a szöveg számai egyezzenek), az „Utolsó frissítés”
  dátuma, és a végén a **Mérföldkövek** (Norbi döntése, 2026-10-22: részletes változásnapló nincs – csak a nagyobb
  funkciók megjelenése, legújabb felül, egy sor naponta). Új funkció a meglévő számozott fejezetbe kerül, ne új
  fejezetbe (a számok eltolódnának). Norbi szemszögéből, pontos feliratokkal; tervezett funkció nem kerül bele.
  Hangnem: könnyed, tegező, de pontos. A címsorokat ne írd át (hivatkozások mutatnak rájuk). Utána a tesztfiókot
  ürítsd ki.
- Roadmap listázásakor minden pont mellé becsült időt írj (teszttel és doksival együtt).

## Elvetett ötletek – magadtól ne javasold újra
Norbi döntései; a részletek a TERV.md-ben.
- **Kinézet**: álló betűs eredeti cím, OLED fekete, 3D billenés a borítókon, plakátszerű
  tipográfia, számláló a fejlécben, „Ma este” kiemelt sáv, haladásgyűrű a sorozatoknál, egyedi helykitöltő a hiányzó
  borítóhoz, a kurzort követő fénylő kártyaél, mozgó borítófal a belépésnél, elmosottból kiélesedő borítók,
  kedvencek borostyán kerete, szikrák 10 csillagnál, felpörgő számok / felnövő oszlopok a Statisztikában, feltöltődő
  franchise-mérők, címlogó az adatlapon (49.1), borító-visszfény a borítófalon (51.6), élő aurora a borítók színéből
  (51.7), a türkiz tehermentesítése (51.2), állapotszín a kiválasztásban (51.3), csak a borító siklik megnyitáskor
  (C2), kisebb üvegelmosás (C3), görgetésre mozduló háttérkép, „Automatikus” téma (70), két magasságú alsó lap (71),
  érintési célok (77), összecsukódó adatlap-fejléc (105), egymásra rétegzett értesítősáv (106); mozis ötletkör
  (D1–D7, D11): lámpaoltás előzetesnél, filmszalagos hibalap, műsorfüzet-stílusú megosztott oldal, lyukasztott jegy a
  megnézetteken, filmszalagos nézési sorrend, függöny belépéskor, Ken Burns a jelenetképen, felületi hangok;
  polcnézet (D8), borítómozaik a Statisztikában (D12), franchise-univerzum (D13); a neonfelirat „rakoncátlan” betűje;
  akadálymentességi kör (A1–A4); kör alakú átmenet témaváltáskor (114); a „Követem” pipájának megrajzolódása (141c).
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
  Statisztikában (112), nyomtatható lista (115), visszaállítási próba (119), borítóválasztó az adatlapon (128), magyar korhatár az adatlapon (126);
  rendezés kritikusi értékelés szerint, RT / MC a kártyán és Mamánál (127).

## Fejlesztői megjegyzés
- Ha a terminál nem ismeri a `node`/`npm` parancsot, a VS Code-ot újra kell indítani (a Node a
  `C:\Program Files\nodejs` mappában van).
- Tesztfelhasználó: `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` – külön Supabase-fiók, Norbi listáját nem látja. Soha ne
  írd ki az értékeit. A teszt végén a tesztfiók listáját ürítsd ki.
- Böngészős teszt: `playwright-core` a scratchpadbe telepítve (nem a projektbe), a gépen lévő Chrome-mal
  (`C:\Program Files\Google\Chrome\Application\chrome.exe`), a helyben futó `npx next start -p 3123` ellen. A tesztek
  és segédszkriptek a `munka/` mappában: a scratchpadbe másolva, ott `npm install` után futtathatók.
- Szkriptből (supabase-js) kilépéskor `signOut({ scope: 'local' })` kell – az alapértelmezett `global` a böngészőben
  futó munkamenetet is lezárja, és az `/api` route-ok 401-et adnak.
- A böngészős teszt „kevesebb mozgás” módban fut (`emulateMedia({ reducedMotion: 'reduce' })`); a mozgást a saját
  lépése kapcsolja vissza. A `page.reload` megvárja a friss listát (`main[data-list]`), a `plainReload` nem; a
  `clearSnapshot()` törli a tárolt listát. Fix várakozás helyett a mentés utáni friss sorra (`rowRefetched`) vagy két
  képkockára (`settle`) vár; képernyőkép csak `SHOTS=1`-gyel. Fő teszt: `munka/e2e/test.mjs`. A szűrősor lenyílóit
  a `munka/e2e/szuro.mjs` kezeli (`typeFilter`, `sortFilter`, `mamaFilterSelect`, `downloadFilter` – asztalon és
  telefonon ugyanazokkal a módszerekkel).
- **Teljes tesztkör**: `munka/e2e/teljes.sh` (a scratchpadbe másolt e2e mappából, Git Bash-ben, ~25 perc); minden
  teszt után üríti a tesztfiókot. Összesítő: `teljes/osszesito.txt`. A `leiras-seed` a címeket
  `details_checked_at`-tel veszi fel (a TMDB-frissítés ne írja át őket).
- Képernyőkép / videó a tesztfiókról: a fejléc e-mail-címét mintacímre kell cserélni
  (`munka/dizajn-2/eszkozok/mask.mjs`); videóhoz a Playwright ffmpeg-je a scratchpadbe kerül
  (`PLAYWRIGHT_BROWSERS_PATH`), lásd `munka/dizajn-2/eszkozok/video*.mjs`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
