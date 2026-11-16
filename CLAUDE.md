# Filmlista – projektleírás Claude Code számára

## Kommunikáció
- Norbival **magyarul**. Windowson, VS Code-ban dolgozik, a terminál alapprofilja Command Prompt (cmd).

## Mi ez?
Személyes webalkalmazás megnézendő filmek és sorozatok nyilvántartására (állapot: megnézendő / folyamatban / megnézve
/ abbahagyva, letöltve jelző, értékelés, franchise-ok). Norbi a fő felhasználó; Mama saját, korlátozott fiókkal
Norbi filmjeit látja és jelöli. Az adatmodell felhasználónként elkülönít.

## Technológia
- **Next.js 16** (App Router), **JavaScript** (nem TypeScript), React 19. **Supabase** (PostgreSQL + Auth +
  Realtime, kliensoldali `@supabase/supabase-js`). **Vercel**: a `main` minden push-a élesít (repó
  `norberttutor/filmlista`, privát; https://filmlista-six.vercel.app/). **TMDB API** (`language=hu-HU`), OMDb.
- Sima CSS változókkal (nincs Tailwind): `app/styles/NN-<téma>.css`, az `app/globals.css` csak `@import`-okkal
  sorolja fel őket. **A sorrend számít** (azonos erősségnél a későbbi győz): új fájl a helyére kerüljön, ne a végére.
- Képekhez sima `<img>`, nem `next/image`. Nincs middleware / proxy; az auth kliensoldali.

## Környezeti változók
`.env.local` (helyben) és Vercel → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY` (anon kulcs, a böngészőbe kerül, RLS véd). A secret /
  service_role kulcs soha nem kerül a kliensbe.
- `TMDB_READ_TOKEN`, `OMDB_API_KEY` (napi 1000 kérés; hiányában értékelés nélkül megy) – **csak szerveroldalon**,
  soha nem kapnak `NEXT_PUBLIC_` előtagot.
- `APP_VERSION` nem kell (Vercelen a commit, helyben `dev`; csak a teszt adja meg).
- Csak helyben: `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`, `MAMATEST_USER_EMAIL` / `MAMATEST_USER_PASSWORD` (**az
  értékeket soha ne írd ki**), `SUPABASE_DB_URL` (admin), `BACKUP_DB_URL` (csak olvasó `backup_reader`; GitHub-titok
  is a heti mentéshez).

## Hol mi van
- **`munka/ROADMAP.md`** – hátralévő feladatok táblázatban, becsült idővel (listázáskor minden pont mellé idő; kész
  feladat sora törlődik).
- **`munka/terv-3/TERV.md`** – Norbi döntései, **elvetett ötletek**, látványterv-linkek; az új pont terve ide kerül
  (kész után csak a jövőt érintő döntés marad).
- **`munka/README.md`** – a helyi (git-ből kizárt) `munka/` mappa leírása és a tesztek tartalomjegyzéke (melyik
  teszt mit vizsgál).
- Régi kódok (K/H/S/I/J/R, „#N”, „terv-3 NN”) oka: `git log --grep`, TERV.md.
- Az itt leírt viselkedés jellemzően Norbi döntése: kérés nélkül ne változtasd.

**Hova mi kerül** (minden munkamenet ehhez igazodjon):
- **Ez a fájl**: csak a mostani működés és a szabályok, ami a kódból nem derül ki – döntés, csapda, összefüggés („ha
  ezt változtatod, ott is”), egy-két sorban, a meglévő szakaszba. **Nem kerül ide**: történet, dátum, commit-hash,
  terv-pontszám, „Norbi döntése” címke, tesztútvonal, elvetett ötlet, a kódból kiolvasható felületi részlet.
- **Teszt**: a `munka/README.md` tartalomjegyzékébe és a `teljes.sh`-ba (ide csak az a tesztekre vonatkozó szabály,
  amit új kódnál / tesztnél be kell tartani – pl. mire várnak a tesztek).
- **Döntés indoka, látványterv-link** → TERV.md (a pontnál); **elvetett ötlet** → a TERV.md „Elvetett ötletek”
  része, rögtön Norbi elvetése után. **Hátralévő feladat** → ROADMAP.md.
- **Munkaanyag** (`munka/terv-3/<pont>/`): napló (`ALLAPOT.md`), látványterv forrása (makett, képek), átnézés
  jelentése. A pont kész (commit) után törölhető – a látványtervből csak a claude.ai-link marad a TERV.md-ben, az
  átnézésből a commitok; kivétel a legutóbbi K2-jelentés (a következő K2 erre épít). Ami újrahasználható eszköz
  (mérő, ellenőrző szkript), az marad: a `munka/README.md` „Hol mi van” táblázatába kerül, ide csak akkor, ha egy
  szabály hivatkozik rá.
- **Claude munkamódja, környezeti csapdák** (eszközök, gép, Norbi munkastílusa) → emlék, nem ez a fájl.

## Fájlszerkezet (csak a nem nyilvánvaló)

### Alap
- `app/layout.js`: a `<head>`-ben `THEME_BOOT_SCRIPT` (`lib/themeBoot.js`), ezért a `<html>`-en
  `suppressHydrationWarning`. A téka betűi `preload: false`.
- `app/page.js`: a `list_viewers` saját sora alapján `MamaView`, különben (hibánál is) `Watchlist`; a választ
  `localStorage` jegyzi (`filmlista-nezo:<userId>`). Net nélkül / lejárt tokennel / ha a `getSession()` nem válaszol
  (4 mp, net nélkül 0,3 mp) a tárolt munkamenettel megy (`storedSession()`, `offline: true`). Kilépés (`signOut()`,
  `lib/offline.js`) csak ezen az eszközön (`scope: 'local'`); net nélkül / 5 mp után helyben.
- Ikonok: mind a `munka/e2e/eszkoz/ikon.mjs`-ből (ellenőrzés: `eszkoz/ikon-ellenorzes.mjs`).
- `app/manifest.js` gyorsindítói (`/?nyit=…`) a `Watchlist` `SHORTCUTS`-ával párban.
- `components/SiteFooter.js`: kötelező TMDB- és JustWatch-forrásmegjelölés, ne töröld; a szponzor `span.sponsor`,
  nem `p` (a teszt egy bekezdést vár a láblécben).
- Regisztráció és elfelejtett jelszó nincs.

### Téma
- Négy téma: sötét (alap, `:root`), világos (`<html data-theme="light">`, `02-vilagos.css`), OLED (`'oled'`,
  `02c-oled.css`, a sötétre épül), videotéka (`'teka'`, csak Norbinál). `lib/theme.js` + `lib/themeBoot.js` (React
  nélküli – a szerverkomponens is használja). **A sötétre vonatkozó `:not([data-theme])` szabálynál az OLED-et is
  vedd fel**: `:is(:not([data-theme]), [data-theme='oled'])`.
- Választás felhasználónként (`filmlista-tema:<userId>`); alapból Mama világos, más sötét; a boot-szkript és a
  belépési oldal az utoljára használtat (`filmlista-tema`), a megosztott oldal a `prefers-color-scheme`-et veszi. A
  nap / hold gomb OLED-ből világosra, onnan sötétre vált; OLED és téka csak a Kinézet ablakból.
- **Kinézet ablak** (`AppearanceDialog`, ⋮ menü): téma + színpár. A színpár a `--accent`, `--neon-2`, `--accent-2`
  együtt (`PALETTES` a `lib/theme.js`-ben, `<html data-pal>`, felhasználónként `filmlista-szinpar:<userId>`; a
  megosztott oldalon nincs; téka mellett nem érvényes). Színek: `02b-szinparok.css`. **Hex értékű új
  `--accent`-függő tokennél (mint a `--chevron-accent`) a párokba is kell érték**; új pár kontrasztja:
  `munka/terv-3/terv-142/szinek.mjs`.
- **Videotéka: a sötét és a világos kinézet nem változhat** – minden téka-szabály `:root[data-theme='teka']`-val
  kezdődik (`03-teka-szinek.css`, `35-teka-felulet.css`), a téka elemei csak `useTheme() === 'teka'` mellett kerülnek
  a lapra (`lib/teka.js`). Ellenőrzés: `munka/terv-3/terv-d/osszevet.mjs` (HEAD vs. új fordítás képpontosan).

### Fő lista – `components/Watchlist.js` + `components/list/`
- A `Watchlist` csak összeköt; a logika a `components/list/` hookjaiban. Az ablakok egy állapotban (`dialog`,
  `openDialog`).
- **Betöltés**: `titles_with_genres` nézet (`loadTitles()`, `fetchAll`) **a leírás (`overview`) nélkül**
  (`LIST_COLUMNS` a `components/list/overviews.js`-ben – **a nézet új oszlopát ide is fel kell venni**). A leírást a
  helyben meglévő, azonos `updated_at`-ű sorból veszi át, a hiányzókat a háttérben (`fillOverviews`) – a sorban ezért
  átmenetileg nincs `overview` kulcs. Háttérfrissítés csak esedékes címnél (`lib/refreshDue.js`). Csendes újratöltés
  (`reloadKey`; szűrők / lapozás / adatlap marad): visszatéréskor, lehúzásra, élő szinkron újrakapcsolódásakor.
- **Offline / csak olvasható**: induláskor a helyben tárolt lista (`stale`), a friss a háttérben; a változás 1,5 mp
  után helyben is mentődik. `readOnly` (tárolt lista vagy nincs net): az írási menüpontok kimaradnak (`ONLINE_ONLY`),
  az adatlap mezői tiltva (`Lock`). **Új írási gombnál a `readOnly`-t is kezeld** (a „Visszavonás” is). A fejléc „Cím
  hozzáadása” gombja tiltva a helyén marad (eltűnve a fejléc másként törne, a lista megugrana; a tesztek az írható
  listát az engedélyezett gombon ismerik fel). `main[data-list]`: `loading` | `stale` | `live` (a tesztek erre
  várnak). Író gomb / tartalom értesítősávban: `toast({ needsNet: 'action' | 'content' })` – net nélkül rejtve.
- **Fejléc** (összecsukódó): `--head-h`, `--head-p` (0–1), `--head-c`; asztalon `main[data-head-away]`.
  **Neonfelirat** (`NeonBrand`): két cső egy sorban, egyforma méretben; munkamenetenként egyszer villan fel
  (`sessionStorage` `filmlista-neon`); 1–4 percenként megrebben vagy újra felkapcsol, ≥ 5 perc távollét és témaváltás
  után is; csak látható lapon, nyitott `<dialog>` nélkül.
- **Szűrők alapállapota** (`DEFAULT_FILTERS`): Filmek – Megnézendő – Nem letöltött – Összes műfaj – Franchise
  nélkül. „Folyamatban” / „Abbahagyva” csak sorozatos típusnál. A Mama-szűrő sorozatnál / franchise-ra szűrve nem
  szűr. Franchise választásakor a típus „all”, az állapot „Mind”; megszűnésekor vissza Filmek. Asztalon (≥ 641 px)
  saját lenyílók (`FranchiseFilter`), telefonon natív `<select>`. **2560 px-en a szűrősor egy sor** (háromjegyű
  darabszámokkal ~33 px tartalék): új szűrőnél mérd újra.
- **„Hol nézhető?” szűrő** (`lib/providers.js`): a `titles.watch_providers` alapján, csak a `PROVIDERS` nyolc
  szolgáltatója + „Egyiken sem”; a még nem ellenőrzött cím (`null`) csak a „Bárhol”-ba számít. Választáskor a
  Letöltés „Mind”-re vált (nem áll vissza); a darabszám a Letöltés-szűrő nélkül számol. Csak akkor látszik, ha van
  ellenőrzött cím. Logó a borítón nincs.
- **Keresés** (`lib/listSearch.js`, elírás-tűrés): gépeléskor a szűrők félreállnak; a mező azonnal frissül, a szűrés
  `startTransition`-ben. **A tesztek a keresőbe írás után az `input.list-search[data-searched]` értékére várnak**
  (új tesztben is).
- **Rendezés**: franchise-ra szűrve nézési sorrend (`WATCH_ORDER` – a lista ekkor tételekből áll: `{ key, title,
  item }`, sorozat évadonként) vagy megjelenés; kézi rendezés után az marad.
- Nézetek: ≥ 1400 px-en lista (`TitleTable`) | rács (`filmlista-nezet`), alatta mindig rács. Lapozás: 25 (telefon /
  keskeny rács), 10 (asztali lista), 22 (asztali rács); az oldal első címét jegyzi.
- **`kept`**: a most szerkesztett sor a szűrés változásáig a helyén marad, akkor is, ha már nem illik a szűrőbe.
- **Törlés visszavonással** (`requestDelete`): azonnal lekerül, 8 mp „Visszavonás”; az adatbázisból csak lejáratkor
  / ×-re törlődik. Nyitott ablak fölötti adatlapból a sáv az ablakok bezárásáig vár (`afterDialogs`). Mentés
  visszaállításakor a függő törlések elmaradnak.
- **Tömeges szerkesztés** (`useBulkEdit`, `BulkBar`): csak az asztali listanézetben, írható listán. **A `td.col-pick`
  jelölőnégyzet az első cella – a `td:first-child` szabályok (állapotpálca, sarkok) ide esnek.** Mentés címenként
  `saveRow`, de egy kötegelt kérésben (`updateTitlesBatch`), ami csak akkor indul, amikor minden érintett sor sorra
  került; visszavonás: a régi mezőértékek visszaírása. Évados sorozatnál „Megnézve” = minden megjelent évad,
  „Abbahagyva” közvetlenül; a többi állapot és a „Letöltve” kimarad (a sáv megmondja).
- „Hogy tetszett?”: táblázatból Megnézve-re váltott, értékelés nélküli címnél, csak a mentett sorra, egyszer; a
  szerkesztőből nem.
- **Letapadt szűrősor** (sticky, `data-stuck`, mögötte `ProgressiveBlur`): **a sáv és az ősei nem kaphatnak
  `backdrop-filter`-t, `filter`-t, `opacity`-t, maszkot** (különben a rétegek nem látnak át). A gyorsgombok
  (`.stuck-tools`) helye nyugalomban is foglalt (`visibility: hidden`), hogy a sor ne törjön másként. A fejléc
  felugrói a szűrősor (`z-index: 30`) fölött.
- **Csúszó kijelölő** (`lib/useSlidingThumb.js`): `className="… sliding"` + `ref={useSlidingThumb()}`; a kiválasztott
  közvetlen gyermek `aria-pressed` / `aria-selected`.
- **Animált átrendeződés**: `components/Reflow.js` – saját FLIP, **nem View Transitions** (az a letapadt szűrősor
  fölé rajzolna, és közben a lap nem kattintható). `data-flip="<kulcs>"`; a réteg ezért `position: relative`.
  `exit(kulcs)`: a kieső tétel saját mozgása.

### A lista elemei
- `PosterCard` (w342), `TitleTable` (w185, `table-layout: fixed`). Mama-oszlop / -jelölés csak `mamaApplies(t)`
  esetén. Mentés: `saveRow`. A `notes` oszlop megvan, de a felületen nincs megjegyzés mező.
- Megnézettre váltáskor kihúzás + színkifolyás (`lib/useStrike.js`); nyitott ablaknál a bezárásáig vár.
- `ImdbBadge`: a szám a skála színével (`--score` 0–100). **RT / MC csak az adatlapon és az asztali listán**, a
  kártyán és Mamánál csak az IMDb. A toplista jelvénye nem színes.
- `Seasons.js`: „Abbahagyva” kézi, az évadjelölés és az új évad sem írja felül; a „Mind megnézve” feloldja. A TMDB-n
  is szereplő törölt évadot a heti frissítés visszahozza.
- `lib/genreColors.js`: a kulcs a TMDB magyar műfajneve.
- `FranchiseFilter`: saját listbox (asztalon a szűrősor többi lenyílója is); a felolvasónak „Név, 2 hátra” (a teszt
  `frOption()`-ja erre épít). **A `.grid` osztálynév foglalt** (borítórács) – a panelé `.ff-grid`. Nyitva
  Vissza-réteg (`useBackLayer`).
- `FranchiseSelect`: `.franchise-new` módban az adatlap nem zár kikattintásra.
- `StarRating` és `lib/radioKeys.js` (**új, azonnal mentő rádiógomb-csoportnál ezt használd**): a nyíl csak a
  fókuszt / előnézetet viszi, Enter / Szóköz ment; a kiválasztottra kattintva `null`, Delete töröl.
- `Toaster` + `lib/toast.js`: `toast({ text, image, content, action, hideClose, duration = 8000, onExpire, kind,
  needsNet })`; az `onExpire` lejáratkor és ×-re fut (az action-re nem); legfeljebb 3; `duration: null` nem jár le.
  **Nyitott `<dialog>` fölött a sáv nem kattintható** – ablakon belül helyi visszajelzés kell.

### Adatlap – `components/TitleEditor.js`
- Natív `<dialog>`, **lapokat tart** (`stack`: `{ id, rowId, item, added }` vagy `{ id, person }`), mindig az utolsó
  látszik. Listán nem lévő címnél **előnézet** („Hozzáadás a listához” / „Már láttam”); felvétel után helyben rendes
  adatlap, nem zárul be. Előnézet a keresőből, Felfedezésből, Hasonló címekből, harangból; a franchise-gyűjteményből
  és importból nem.
- Az elöl lévő lap `apiRef`-en adja a `canLeave`-et. Fókusz a címen (`id="editor-title"` csak a látható lapé). A
  rejtett lapon nem szól az előzetes.
- „Cím másolása” (`CopyTitle`): telefonon nincs (≤ 640 px, CSS). A `<h2>`-n belül az utolsó szóval együtt törik
  (`.title-end`); **a gomb mérete nem változhat** (a „Másolva” `::after` buborék), különben a cím kattintásra
  újratörik. A gombban nincs szöveg (a tesztek a `#editor-title` szövegét hasonlítják); az ablak neve a rejtett
  `#editor-title-name` (a `PersonPage`-en is).
- **Azonnali mentés**: minden mező kattintásra ment (`save()` → `saveRow`), nincs Mentés / Mégse; `.saved-note`
  visszavonással (10 mp). A törölt franchise üresre állítása nem mentendő (`deleted` ref).
- `watched_at` nem látszik (megnézettre állításkor a mai nap). „Abbahagyva” csak sorozatnál.
- Adatsor (`.meta`): év · Film / Sorozat · sorozatnál az állapot szavakkal · játékidő (sorozatnál a legutóbbi rész) ·
  IMDb. Korhatár nincs. Mamánál csak a játékidő.
- **Bezárás**: `DialogClose`, Esc, kikattintás asztalon, Vissza. Törlés-megerősítésnél (az utolsó évadénál is –
  `.season-confirm`) a kikattintás nem zár, az Esc igen. `closedby="none"` (Android – lásd Ablakok bezárása).
- **Nézetváltás** (`lib/viewTransition.js`): a borító átsiklik az adatlapra, ezért a `showModal()`
  `useLayoutEffect`-ben fut. Csak az első lapról siklik vissza, törléskor nem.
- Hangulatszín: az ablak saját háttere, nem `::before` réteg (az görgetéskor felgördült).
- Részek: `TopCast` (`/api/tmdb/credits`), `PersonPage` (`/api/tmdb/person`, közös forrás `lib/server/people.js`),
  `TitleGallery` (az Esc a window rögzítő fázisában), `WatchProviders` (HU `flatrate` + `free` + `ads`; **kötelező
  „Forrás: JustWatch”**), `SimilarTitles`, `Trailer` (`youtube-nocookie.com`). A később érkező részek beúsznak
  (`lib/useArrival.js`).
- **A nap filmje** (`lib/pickOfDay.js`, `PickOfDay`): a letöltött, megnézendő filmekből; a napi film a budapesti
  dátumból és a felhasználóból számolódik, a „Másikat” választása eszközönként aznapra (`filmlista-napfilmje:<userId>`).
  Az adatlap `pick` propot kap: `section.potd` (nem `div` – az ablak `> div` szabályai); pörgés alatt
  `dialog[data-picking]` (az adatlap `display: none`); a sorsoló összecsukódása a `spinning` propból jön, nem saját
  állapotból. Pörgés alatt `aria-disabled`, nem `disabled` (a fókusz a gombon marad).

### Felfedezés, kereső
- `TitleSearch`: 400 ms késleltetés, személyek is (≤ 6). A mező felirata „Film vagy sorozat címe – vagy színész,
  rendező” (**az eleje a tesztek kapaszkodója**). `focus({ preventScroll: true })`, **nem `autoFocus`** (az
  megszakítaná az `openAdd` görgetését).
- `Discover` + `lib/server/discover.js`: **Norbit csak a magyar szinkronos címek érdeklik** – közelítés: film = HU
  megjelenés (`region=HU`, release type 2|3 vagy 4), sorozat = HU előfizetéses streaming, 90 napon belüli rész; angol
  vagy magyar eredeti, van magyar leírás; nincs dokumentum / valóságshow / talkshow / hírek / szappanopera /
  **animáció**. A megnyitáskor már listán lévőket és az elrejtetteket kihagyja. A Hasonló címek és a kereső nem szűr
  így. A `.discover` oszlopa `minmax(0, 1fr)` (különben telefonon az egész lap kicsinyedik).
- `FeaturedBand`: hibánál elmarad; „Neked ajánlott” a 8+ értékelésűekből. Lapozáskor a kép és a szöveg címenként új
  elem, **külön kulccsal (`kep:` / `szoveg:`)** – azonos kulcsnál a régiek a lapon maradtak.
- „Nem érdekel” (`lib/hiddenSuggestions.js`): a Felfedezés és a Hasonló címek szűri, a keresés nem.
- Felvételkor a borító a fejléc számához repül (`lib/flyPoster.js`). **„✓ A listán” mindenhol
  `components/OnList.js`** (a tesztek a szöveget keresik; a pipa egy `.tick` span).

### Franchise-ok
- `FranchisesDialog`: ábécérend **névelő nélkül** (A / Az / The). Szerkesztés / megerősítés közben az Esc és a
  Vissza csak azt zárja. TMDB-hibánál újrapróbálás, nem „nincs TMDB-gyűjtemény”.
- `FranchiseSuggestions` + `lib/franchiseSuggest.js`: **csak felajánl**, magától soha nem rendel hozzá, a meglévőt
  nem írja át; nyitott `<dialog>` alatt a bezárásáig vár.
- `FranchiseCollection` (Gyűjtemény / Nézési sorrend fül): felvételkor az ablak nyitva marad.
- `FranchiseActions` (logóválasztó, `logo_path: ''` = „Csak a név”): **mentés közben a gombok nem tiltódnak** (a
  fókusz a body-ra esne, és az Esc az egész ablakot zárná). `/api/franchises/logos` csak `logo_path is null`-nál ír.
- `WatchOrder` + `lib/watchOrder.js`: kulcs `címId:évad` (0 = film); „Kész” → `set_franchise_order` RPC.
- Megosztott sorrend (`ShareOrder`, `lib/shares.js`, `app/sorrend/[token]/`): szerverkomponens (`connection()`, nem
  indexelt); állapot / értékelés / letöltve / Mama nem látszik; hibás link 404; a service worker nem kezeli.

### Egyéb ablakok
- **Toplisták** (`ToplistsDialog`, `lib/server/toplists.js`): minden osztály `toplist-` előtagú (**a `.top-*` a
  fejlécé, a `.tl-*` az évad-idővonalé**). Szűrés (`huOk()`, „laza”): film – angol / magyar eredetinél HU megjelenés
  vagy bármely HU szolgáltató, más nyelvűnél csak HU megjelenés; sorozat – HU streaming; magyar leírás kell;
  dokumentum / hírek / valóságshow / szappanopera / talkshow / koncertfilm nincs, **az animáció benne van**.
  IMDb-értékelés: `imdb_ratings` (30 nap) → saját lista → OMDb, napi keret 400 (`DAILY_OMDB`, párhuzamos
  összeállításnál sem lépi túl). Lista 7 napig tárolva (`toplists`); első összeállítás 10–30 mp (`maxDuration = 60`).
- **Színészek és rendezők**: `lib/people.js` (`followPerson` – követéskor rögtön `refreshPeople`, az első ellenőrzés
  csak megjegyez). `PeopleDialog`: az Esc / Vissza az idővonalról a csempékhez lép. `FollowSuggestions`
  (`/api/people/suggest`): elrejtés `localStorage`-ban.
- `MoreMenu` (⋮): pontok `{ id, label, description, icon, onSelect, disabled? }` – a tiltott pont látszik
  (`aria-disabled`), a leírása mondja meg, miért.
- `NotificationBell` + `lib/notifications.js`: `loadNotifications()` előbb lefuttatja a `collect_*_notifications()`-t;
  olvasottra csak azonosító szerint; törlés = `dismissed_at`. A `mama_interested` csak akkor látszik, ha a
  `mama_status` most is „Érdekli” / „Megkapta”.
- Telefonos felugrók portálon a `body`-ba (`lib/popupSide.js`, `lib/usePhonePopup.js`) – a fejléc gombsorának
  transzformja a `position: fixed` listát különben a gombsorhoz igazítaná.
- `lib/errorLog.js`: **kliensoldalon `console.error(error)` helyett `reportError(error)`** (konzolra is ír,
  `log_client_error` RPC; a hálózati hibát, megszakítást, böngészőzajt kihagyja).
- `PasswordDialog`: a jelenlegi jelszót **külön, nem tároló Supabase-kliens** ellenőrzi (`persistSession: false`,
  saját `storageKey`, utána `signOut({ scope: 'local' })`); hibakódok: `lib/authErrors.js`. A tesztje a tesztfiók
  jelszavát a végén mindenképp visszaállítja.
- `ManualDialog`: a `FELHASZNALOI-LEIRAS.md`-ből a `scripts/leiras.mjs` készíti a `public/leiras/`-t (`npm run dev` /
  `build` elején; git-ből kizárva).
- Importok: `BulkImport` (csak asztalon), `ImdbRatingsImport` (az IMDb csillaga felülírja a sajátot, új cím nem
  kerül fel); bezárás után a háttérben végigfut (`runRef`). Automatikus IMDb-szinkron nincs (nincs API, a gépi
  olvasás tiltott).
- `lib/exportList.js`: CSV Excelhez (UTF-8 BOM, pontosvessző, tizedesvessző).

### Mama
- `MamaView` + `MamaDetail`: fülek „Filmek” / „Érdekel”; optimista `mama_mark()` (címenként sorba állítva). Helyben
  nem tárol. Visszatéréskor `useAppFreshness`. Az adatlapja saját ×-szel / fogantyúval zár (nem `DialogClose`).

### Közös könyvtárak
- `lib/api.js` `apiGet()`: saját `/api` route Bearer tokennel.
- `lib/titles.js`: címműveletek (a `titles_with_genres` friss sorát adják vissza), háttérfrissítők (utolsó paraméter
  `isCancelled`), `releaseState(t)` (mozis bemutató után 120 napig moziban), `mamaApplies`, `todayDate()` (budapesti
  idő). A franchise nevét a kliens keresi ki (nincs a nézetben).
- **Gyorsítótár-verziók – a válasz mezőinek / szűrésének változásakor emeld**: `DETAILS_V`, `CREDITS_V`, `SIMILAR_V`
  (`lib/titles.js`, a kérők mind innen veszik), `PERSON_V`, `DISCOVER_V`, `SUGGEST_V`, `TOPLIST_V`.
- `lib/rowSaves.js` `saveRow(sor, apply, kérés, show)`: soronként sorba állított optimista mentés – **új optimista
  mentésnél ezt használd**. `isOptimistic(row)` (mellékhatás csak mentett sorra), `rebasePending` (a háttérfrissítés
  a függő mentés alapjába ír). **Helyi írások jelölése** (`noteLocalWrite` / `writtenSince`): a csendes újratöltés és
  az élő szinkron a kérés indulása után helyben írt címnél a helyi sort tartja meg – **új, a fő listát helyben író
  útnál (a `replaceTitle` / `handleAdded` / `applyRatingsLocally` / törlés mellett) jelölni kell**; az élő szinkron
  `replaceTitle(row, { remote: true })`. A franchise-sorrendnél ugyanez: `orderWrittenSince`.
- `lib/fetchAll.js`: a PostgREST kérésenként legfeljebb **1000 sort** ad – **teljes listát lekérő új lekérdezésnél
  ezt használd**, egyértelmű rendezéssel; a címeknél kulcs szerinti lapozással (`afterId` / `afterCreated` –
  eltolással a két adag között felvett / törölt cím kettőzne vagy kimaradna).
- `lib/refreshDue.js`: esedékességi szabályok; **a route-ok ugyanezt kérdezik (részben SQL-ben) – változtatáskor
  mindkét helyen.**
- `lib/posterColor.js` `usePosterColor`: hangulatszín a w92-es borítóból, **saját gyorsítótár-kulccsal (`?szin`)** (a
  CORS nélkül tárolt kép a vásznat tiltaná).
- `lib/viewTransition.js` `afterTransition()`: **a szerkesztő megnyitásakor érkező, nem sürgős állapotfrissítést
  ezzel késleltesd** (terhelt gépen akadást okozott).
- `lib/afterDialogs.js`: `afterDialogs(fn)` – ha már nincs nyitott `<dialog>` (a nyitva eltávolítottat is
  észreveszi); `useAppearance(on)` – jelölés mozgása az adatlap bezárásakor (`'wait'` → `'play'`).
- `lib/useHoldEscape.js`: **mentés közben az Esc ne zárja az ablakot – ehhez ez kell**, a `cancel`
  `preventDefault`-ja nem elég (a Chrome a második Esc-et nem engedi megakasztani).
- `lib/prefetch.js`: rámutatásra előtöltés **ugyanazzal az URL-lel, mint a `TitleEditor` – ha ott a paraméterek
  változnak, itt is**.
- `lib/appVersion.js` + `/api/version`: `useAppFreshness` (≥ 5 perc rejtés után csendes újratöltés; új buildnél
  „Frissült az app” sáv).
- `PullRefresh`: csak érintéssel, a telepített appban.
- `lib/liveSync.js`: Realtime; feliratkozásonként új csatornanév; a törlésről csak a kulcs jön. A `useLiveTitles` a
  saját visszhangot, a függő mentésű és függő törlésű címet kihagyja.
- **Ablakok bezárása**:
  - `components/DialogClose.js`: **minden ablak `<dialog>`-jának első gyermeke** (asztalon ragadós „Bezárás” jobbra
    fent, telefonon fogantyú – lehúzva zár, az ablak ettől alsó lap). Ezért az ablak `> div` szabálya: `>
    div:not(.dialog-close-bar)`. Az ablak alján nincs „Bezárás” (a művelethez tartozó „Mégse” marad). Helye:
    `--close-top` / `--close-right`, a fejléc helyet hagy neki.
  - `lib/useBackdropClose.js` `useBackdropClose(dialogRef, { onClose, canClose, onBlocked })`: kikattintásra zár
    (asztalon); ha nem zárhat, `nudgeDialog()`. A `DialogClose` ugyanazt kapja (`const closing = { onClose, canClose
    }`). Nem zár bevitel / szerkesztés / megerősítés / folyamatban lévő mentés vagy felvétel alatt (az adatlap net
    nélkül zár); Statisztika, Leírás, Kinézet mindig zár; **az importablakok soha**.
  - `lib/backClose.js`: a Vissza gomb a legfelső réteget zárja (rétegenként `history.pushState`); a modális
    `<dialog>`-okat MutationObserver kezeli – **új ablakhoz nem kell semmi**; saját szabály: `dialog.backHandler` →
    'stay' | 'stepped' | 'closing'; nem dialog réteg: `useBackLayer(open, close)`. **Android**: nyitott modális
    ablaknál a vissza-gesztus `cancel`-ként jut az ablakhoz, ezért az adatlap `closedby="none"`, az Esc-et `keydown`
    kezeli, a lapjai saját bejegyzést kapnak (`pushDialogPage` / `popDialogPage`). **A bejegyzések
    `scrollRestoration = 'manual'`-lal** (`pushOwn`) – különben a réteg bezárásakor a lap a nyitásakori helyre ugrana.
- `public/sw.js` + `lib/offline.js`: service worker (csak kiadott változatban); az `/api` és a Supabase nem
  tárolódik. A borítótároló a tárolt listából dönt: `LIST_SIZES` w342 / w185 – **a `PosterCard` / `TitleTable` /
  `FranchiseFilter` képméretének változásakor itt is**. **A tárolás módjának változásakor emeld a `VERSION`-t.**
  Minden válasz a `respond()`-on át: a tároló hibájánál (már a `caches.open`-nél is) a hálózatról; a tárolóba írás
  hibája nem buktathatja el a választ. Lista: IndexedDB (`loadSnapshot` / `saveSnapshot` / `clearSnapshots`).

### Szerveroldal
- Minden `lib/server/` modul `import 'server-only'`-val kezdődik (újba is tedd bele).
- `lib/server/auth.js` `checkAuth()`: a tokent helyben ellenőrzi (`getClaims()`); `{ user }` vagy `{ response }` (401
  – a névtelen munkamenet is –, az ellenőrzés hibájánál 503); `supabaseAsUser()`. Az `/api/tmdb/*` token nélkül 401.
- `lib/server/tmdb.js`: `tmdbFetch()` (10 mp), `cachedResponse(body, mp)` – **hibás vagy részben hiányos válasz soha
  nem tárolható** (ilyenkor sima `Response.json`), `cached()` (memória), `pick*` segédek (a `details`, `seasons`,
  `details-refresh` közös forrása), `ANIMATION_GENRE`.
- Lekérő route-ok (`app/api/tmdb/…`, GET): ha a cím már nincs a TMDB-n, üres / null. A `details`-ben az OMDb hibája
  nem akadályozza a felvételt. `similar`: ≥ 2000, TMDB ≥ 6,0, ≥ 50 szavazat, animáció nélkül.
- Háttérfrissítő `POST` route-ok (a felhasználó jogaival, kötegekben, a `Watchlist` hívja betöltéskor): `imdb/refresh`
  (RT / MC is), `tmdb/seasons`, `backdrops`, `releases`, `title-collections`, `collection-parts`, `details-refresh`,
  `watch-providers` (megnézendőnél hetente, megnézettnél havonta), `franchises/logos`, `people/refresh`. Szabályok:
  - **A címet író frissítő az új `updated_at`-et is visszaadja** (a `details-refresh` a csak ellenőrzöttekét is,
    `checked`) – különben a tárolt leírás elavultnak látszik, és újra letöltődik.
  - Az értesítést írók (`collection-parts`, `people/refresh`) **előbb az értesítést, utána az ismerteket írják**, és
    első ellenőrzéskor csak megjegyeznek; le nem tölthető gyűjteményt nem jelölnek ellenőrzöttnek.
  - A `tmdb/seasons` az állapothoz nem nyúl, kivéve az első kitöltést (az évad nélkül kézzel beállított állapot /
    „Letöltve” a megjelent évadokra kerül); a `series_status` / `runtime` itt frissül, a megnézett sorozatoknál is.
  - A `details-refresh` a címet **csak akkor** cseréli magyarra, ha most az eredeti áll ott; a saját adatokhoz nem nyúl.
- `app/api/keepalive` + `vercel.json`: napi cron, a Supabase ingyenes projekt ébren tartása.
- `.github/workflows/mentes.yml`: heti külső mentés (`BACKUP_DB_URL`), 8 napnál régebbi mentésnél hibával áll le.
  Visszatöltés: `munka/e2e/eszkoz/mentes-feltoltes.mjs <fájl.json> <e-mail>`; a `backup_reader` jelszavának cseréje:
  `eszkoz/mentes-olvaso.mjs`, utána a GitHub-titok is.
- `supabase/*.sql`: a már lefuttatott adatbázis-szkriptek (számozva).

## Adatbázis (részletek: `supabase/`)
- `statuses`: `to_watch`, `watching`, `watched`, `dropped` (a `dropped`-ot a felület csak sorozatnál kínálja).
  `genres.id` = TMDB műfaj ID.
- `titles`: `user_id` (default `auth.uid()`), egyedi `(user_id, media_type, tmdb_id)`. `mama_status`: null |
  'interested' | 'declined' | 'received'. `franchise_id` on delete set null. `my_rating` 1–10. `release_date`
  sorozatnál `first_air_date`. `runtime` perc, sorozatnál a legutóbbi részé (a TMDB `episode_run_time` szinte mindig
  üres). `series_status` a TMDB `status` szövege (a kliens fordítja). `rt_rating` / `mc_rating` 0–100 (sorozatnál
  gyakran nincs). `watch_providers` int[] (`[]` sehol, NULL még nem néztük). `*_checked_at` ellenőrzési időbélyegek.
- Triggerek: „Megnézve”-re váltáskor `is_downloaded` hamis (utána kézzel bejelölhető; a felület is leveszi).
  `title_seasons` (PK `(title_id, season_number)`): a sorozat `status` / `is_downloaded` / `watched_at` az évadokból
  számolódik – minden megjelent évad megnézve → `watched`; van megkezdett → `watching`; különben `to_watch`; a
  bejelentett évad nem számít; kivétel a kézi `dropped`. Évados sorozat `status`-ának közvetlen írásakor (a `dropped`
  kivételével) az évadokból számolt érték kerül be. Évadok nélkül a cím kézi.
- `franchises`: `logo_path` null = még nincs, `''` = „Csak a név”; `tmdb_collection_ids` NULL is lehet (üresnek
  veendő); egyedi `(user_id, lower(name))`.
- `franchise_order` (`season_number` 0 = film); `set_franchise_order` egy tranzakcióban, csak a franchise-ban lévő
  címeket veszi fel. Trigger: más franchise-ba került cím kikerül a régi sorrendből.
- `franchise_collection_parts`, `followed_person_credits`: ismert részek / filmek (ebből derül ki, mi új). A
  `followed_person_credits` jelzősora (`tmdb_id = 0`) **az első (csendes) ellenőrzés jele** (a `checked_at` nem jó – a
  mentés visszahozza).
- `hidden_suggestions`, `followed_people` (PK `(user_id, person_id, role)`).
- `notifications.kind`: 'season_announced' | 'season_aired' | 'movie_digital' | 'mama_interested' | 'collection_new' |
  'person_new' (az utóbbi kettőnél `title_id` üres). A törölt (`dismissed_at`) sor megmarad, így a gyűjtők nem írják
  újra.
- `backups`: `backup_snapshot(user)` version 4; a régebbi mentésből hiányzó táblák visszaállításkor nem változnak.
  Írni csak a függvények (`write_backup`, `create_my_backup`, `restore_my_backup` – előbb `before_restore` mentés);
  pg_cron hétfőn. **Visszaállítás alatt `set_config('filmlista.restoring', 'on', true)`**: a
  `clear_downloaded_when_watched`, `title_seasons_before_write`, `sync_title_from_seasons` trigger ilyenkor nem
  módosít – ha ezeket módosítod, a jelző-vizsgálat maradjon az elejükön (a `session_replication_role` itt nem
  állítható).
- Nincs a mentésben: `franchise_shares`, `list_viewers`, `client_errors`, `imdb_ratings`, `toplists`,
  `franchise_collection_parts`, `followed_person_credits`, a cím nélküli értesítések.
- `franchise_shares` (token; visszavonás = törlés), `shared_watch_order(token)` (security definer, `anon` is):
  állapot, értékelés, letöltve, Mama, megjegyzés, user_id soha.
- Mama: `list_viewers (viewer_id → owner_id)` – írni csak SQL-ből (`munka/e2e/eszkoz/mama-kapcsolas.mjs`).
  `mama_list()`, `mama_mark()` (security definer; Mama a `titles`-t közvetlenül nem látja). „Nem érdekli” → „Érdekli”
  csak a listáján lévő filmre, vagy ha korábban „Érdekli” volt. **`title_released(t)` a `releaseState()` szabálya
  SQL-ben – ha az egyik változik, a másikat is.**
- `client_errors`: írni csak a `log_client_error()`; Mamánál a gazda naplójába kerül. `imdb_ratings`, `toplists`:
  **közös** gyorsítótár, írni csak a `store_*` függvények; a közös táblákat (`genres` is) a néző nem írhatja.
- `titles_with_genres` nézet (`security_invoker`): `titles.*` + `status_name` + `genres` + `seasons`. Realtime:
  `titles`, `title_seasons`, `notifications`, `franchises`.
- Minden táblán RLS (csak a saját sorok); az `anon` csak olvashat, TRUNCATE senkinek (az új táblákra is így).
- **Szabályok:**
  - Sémamódosításnál új számozott SQL fájl a `supabase/`-ba. Ha a nézet oszlopai változnak (a `t.*` is!), a nézetet
    újra kell létrehozni (`drop view` + `create view`).
  - **Mentett táblába új oszlop csak NULL-t engedő** (vagy a visszaállítás tölti ki), különben a régi mentések nem
    állíthatók vissza.
  - Futtatás: Claude a `SUPABASE_DB_URL`-lel (Session pooler, admin, RLS nélkül) a `pg` csomaggal (a scratchpadbe
    telepítve), egy tranzakcióban (hibánál `rollback`); csak a `supabase/` számozott fájljait. Adatot törlő vagy
    táblát eldobó lépés előtt kérdezz rá (a nézet újralétrehozása kivétel). Utána ellenőrizd.
  - Push csak a séma után (az új kód az új oszlopokra számít).

## Konvenciók
- Felületi szövegek magyarul, mondatkezdő nagybetűvel, cselekvő igékkel („Hozzáadás a listához”, nem „Submit”). A
  hibaüzenet mondja meg, mi a baj és mit tegyen a felhasználó.
- Az alapállapot (`to_watch`, `DEFAULT_STATUS`) a felületen **üresen** jelenik meg (csak a szűrőgomb nevezi meg). Az
  adatlapon a kiválasztott állapotra / Mamára újra kattintva üres lesz.
- Megnézett és abbahagyott cím: fekete-fehér, fakó borító, tompított, de olvasható szöveg (`--watched-text`, ≥ 4,5:1)
  – nem az egész sor átlátszó; rámutatva és fókuszban teljes színű.
- **Színek**:
  - **Új színtokennél a világosba is kell érték**, és mérd a kontrasztot (`munka/terv-3/terv-50/kontraszt.mjs`,
    `VEGLEGES=1`). Tokenek OKLCH-ban, mellettük megjegyzésben a hex (hexből: `munka/dizajn-2/eszkozok/oklch.mjs`); a
    build hex / `lab()` tartalékot generál, ezért a teszt vásznon át, sRGB-ben hasonlít (`rgbOf`).
  - **Beégetett színt ne használj**: fátyol `rgb(var(--tint) / 0.05)`, árnyék `rgb(var(--shade) / calc(0.6 *
    var(--shade-k)))`, üveg `rgb(var(--glass) / 0.8)`, `::backdrop` `rgb(var(--scrim) / calc(0.62 *
    var(--scrim-k)))`; teli piros gomb felirata `--danger-ink`.
  - `--ambient` (a film / franchise színe): keverési arány `min(100%, calc(N% * var(--ambient-k)))`, teli színű vonal
    / ikon `var(--ambient-ink)`; kivétel a `--ambient-label` és a `::backdrop`.
  - **Sötét szigetek**: a képes sávok világosban is sötétek (`.featured-slide`, `.featured-sk`,
    `.collection-banner[data-backdrop]`, `.share-hero[data-backdrop]`, `.fr-logo`, galéria) – a sötét tokeneket a
    `:root` szabály kiválasztója adja nekik (a P3-asé is); új képes sávot ide is fel kell venni.
  - `--accent` (neon türkiz): gombok, állapotok („Folyamatban” is), kiválasztott szűrők, fókuszkeret. Teli türkiz
    csak a fő műveleteknél (Cím hozzáadása, Hozzáadás a listához, Belépés); a kiválasztott állapot `--accent-soft`
    háttér + `--accent-line` keret. P3-on élénkebb `--accent` / `--accent-2`.
  - `--accent-2` (borostyán): **csak a saját jelöléseken** (saját értékelés, Mama, harang száma, Statisztika
    értékelés-csempéi), soha nem gombszín.
  - Állapotszínek `--st-<kód>`; **új állapotnál szín és `[data-status=...]` szabály is kell** (kártya és sor).
  - Tartalomfajták (soha nem gombszínek; teljes erővel csak apró jelölésen): `--c-coral` mozi, `--c-indigo`
    bejelentett / hamarosan (a még meg nem jelent évad / rész mindenhol indigó szaggatott, `data-upcoming`), `--c-sky`
    digitális / letöltve, `--c-sage` megjelent, `--c-rose` ajánlás.
  - Értékelés-skála (csak a számon, soha nem gombon / állapoton): 40 alatt piros, 60-nál sárga (zöldes, nem
    borostyán), 80-tól zöld.
- Gombok kerek végűek, rámutatva világosodnak, lenyomva sötétednek.
- Saját lenyíló-nyíl (`--chevron`) és jelölőnégyzet (`--check-mark`); ahol egy szabály `background` rövidítést ad egy
  lenyílónak, a nyilat is újra meg kell adni. Natív `<select>`: `appearance: base-select` (`@supports` mögött); a
  telefonos szűrő-opciók előtt ikon (`--opt-icon`) / szín (`--opt-dot`) – **új opciókódnál ide is kell ikon, és
  asztalra a `components/FilterIcons.js`-be is**.
- **Mozgás**: legfeljebb ~0,2 s-os átmenetek; kivételek a `36-mozgas.css`-ben (új kivétel is oda), valamint helyben,
  megjegyzéssel: aurora (`04-alap.css`), telefonos alsó lap (`39-adatlap-elrendezes.css`, `44-mama.css`), csúszó
  kijelölő (`45-csuszo.css`). A `46-kevesebb-mozgas.css` mindent kikapcsol; a JS-ből indított mozgások (`Reflow`,
  `viewSwitch`, nézetváltás) maguk nézik a `prefers-reduced-motion`-t.
- Görgetősáv: saját (`::-webkit-scrollbar`); elemre ne adj `scrollbar-width` / `scrollbar-color`-t (Chrome-ban akkor
  a `::-webkit-scrollbar` nem érvényes).
- „Squircle” sarkok (`corner-shape: squircle`, `@supports` mögött): borító 22 px, kis borító 13 px, szerkesztő ablak
  32 px, panelek 20 px, mezők 12 px; új lekerekített elemnél (és `::before` / `::after` keretnél) is kell; a pirula és
  a kör kivétel. A `34-squircle.css` után jövő fájlok elemeinél a szabály helyben áll (különben a későbbi
  `border-radius` felülírja).
- **Új ablaknál (`<dialog>`)**: `DialogClose` az első gyermek, és vizsgáld a kikattintásos bezárást (`canClose`):
  mikor ne zárjon (bevitel / szerkesztés / megerősítés / folyamatban lévő művelet); ha szándékosan nem zár, írd oda
  megjegyzésben. Ha egy másik `<dialog>`-on belül nyílik a React-fában, a külső `onClose` csak a sajátjára zárjon
  (`e.target === e.currentTarget`) – a React a belső „close” eseményét is továbbítja.
- Új dizájnötletnél: előbb látványterv (képek a valódi appból, `munka/terv-3/terv-84/` mintára), beépítés csak Norbi
  jóváhagyása után.
- **Felhasználói leírás** (`FELHASZNALOI-LEIRAS.md`, képek: `docs/kepek/*.jpg`): **csak Norbi kérésére, időszakosan
  frissül**; fejlesztés commitjában ne nyúlj hozzá. Frissítéskor: a leírás utolsó commitja óta készült változások
  (`git log $(git log -1 --format=%H -- FELHASZNALOI-LEIRAS.md)..HEAD`) alapján a szakaszok, a változott felület képei
  (`eszkoz/proba-lista.mjs`, majd `munka/terv-3/33-leiras/leiras-kepek.mjs <név>`; a jelölők és a szöveg számai
  egyezzenek), az „Utolsó frissítés” dátuma, a végén a **Mérföldkövek** (csak nagyobb funkciók, legújabb felül, egy
  sor naponta; részletes változásnapló nincs). Új funkció a meglévő számozott fejezetbe kerül, ne újba; a címsorokat
  ne írd át (hivatkozások mutatnak rájuk). Norbi szemszögéből, pontos feliratokkal, könnyed, tegező, de pontos
  hangnemben; tervezett funkció nem kerül bele. Utána a tesztfiókot ürítsd ki.

## Elvetett ötletek
Norbi sok kinézeti és funkcióötletet elvetett. **Új ötlet vagy funkció javaslata előtt nézd át a
`munka/terv-3/TERV.md` „Elvetett ötletek” részét**, és ami ott szerepel, magadtól ne javasold újra.

## Fejlesztői megjegyzés
- Ha a terminál nem ismeri a `node` / `npm` parancsot, a VS Code-ot újra kell indítani (Node: `C:\Program
  Files\nodejs`).
- Szkriptből (supabase-js) kilépéskor `signOut({ scope: 'local' })` kell – az alapértelmezett `global` a böngészőben
  futó munkamenetet is lezárja, és az `/api` route-ok 401-et adnak.
- **Tesztek**: `munka/e2e/<mappa>/<téma>.mjs` – `mukodes/` (böngészős, felületi működés), `kinezet/` (elrendezés,
  színek, kontraszt, mozgás), `adatbazis/` (triggerek, RLS, függvények – visszagörgetett tranzakcióban), `szerver/`
  (`/api` route-ok), `eszkoz/` (segéd, próbalista, karbantartó szkript – nem teszt). Melyik mit vizsgál:
  `munka/README.md`. Futtatás: a scratchpadbe másolva, ott `npm install` után; `playwright-core` (a scratchpadbe
  telepítve) a gépen lévő Chrome-mal (`C:\Program Files\Google\Chrome\Application\chrome.exe`), a helyben futó `npx
  next start -p 3123` ellen.
- Tesztfiók (`TEST_USER_*`): külön Supabase-fiók, Norbi listáját nem látja; **a teszt végén a listáját ürítsd ki**.
  A Supabase korlátozza a sűrű belépést: az ürítés az adatbázisból megy (`clearAccountDb`), a belépés újrapróbál
  (`signInWithRetry`, `loginForm`) – ne lépj be fölöslegesen.
- **Új teszt**: a közös keretre épül (`eszkoz/keret.mjs`: `step` / `check` / `assert`, `open({ phone, mama, … })`
  (belépett lap, „kevesebb mozgás”), `settle(page)`, `addFromTmdb`, `adminDb()` (visszagörgetett tranzakció),
  `clearAccountNowAndAtEnd`, `onCleanup`, `finish()`). Neve azt mondja meg, mit vizsgál (nem a terv számát),
  kisbetű, ékezet nélkül, kötőjellel; több független pont: `vegyes-<csomag>`; első sor megjegyzése a terv pontszáma
  (`// terv-3 132`). Fel kell venni a `teljes.sh`-ba és a `munka/README.md` tartalomjegyzékébe.
- A tesztek „kevesebb mozgás” módban futnak; a mozgást a saját lépése kapcsolja vissza (`emulateMedia({ reducedMotion:
  'no-preference' })`). A `page.reload` megvárja a friss listát (`main[data-list]`), a `plainReload` nem; a
  `clearSnapshot()` törli a tárolt listát. Fix várakozás helyett a mentés utáni friss sorra (`rowRefetched`) vagy két
  képkockára (`settle`) várj. Képernyőkép csak `SHOTS=1`-gyel. Segédek: `eszkoz/szuro.mjs` (a szűrősor lenyílói,
  asztalon és telefonon), `eszkoz/kinezet.mjs` (`pickTheme`, `pickPalette`).
- **A tesztek próbacímeinél minden `*_checked_at` „most” legyen** (`checkedNow()`), különben a frissítő teszt közben
  átírja a sort; a próbalista (`eszkoz/proba-lista.mjs`) is így vesz fel.
- A régi fő teszt 11 szakasza (`eszkoz/fo-kozos.mjs`) felvett kiinduló állapotból indul (`eszkoz/minta/fo-teszt/`,
  újra: `FELVESZ=1`).
- **Teljes tesztkör**: `munka/e2e/teljes.sh` (a scratchpadbe másolt e2e mappából, Git Bash-ben, ~40 perc; egy mappa:
  `CSAK=kinezet`, a meglévő fordítással `NOBUILD=1`); minden teszt után üríti a tesztfiókot. Összesítő:
  `teljes/osszesito.txt`, lépésszámok: `node eszkoz/lepesszam.mjs teljes`.
- Képernyőkép / videó a tesztfiókról: a fejléc e-mail-címét mintacímre kell cserélni
  (`munka/dizajn-2/eszkozok/mask.mjs`); videóhoz a Playwright ffmpeg-je a scratchpadbe kerül
  (`PLAYWRIGHT_BROWSERS_PATH`), lásd `munka/dizajn-2/eszkozok/video*.mjs`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
