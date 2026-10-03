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
  „Megnézendő filmek és sorozatok”; szűrősor
  balról: Típus lenyíló (Filmek / Sorozatok; kiválasztott franchise vagy keresés
  mellett plusz „Filmek és sorozatok” – `type: 'all'`, ami franchise választásakor
  automatikusan beáll, a franchise-szűrő megszüntetésekor vissza Filmek) – állapotgombok
  (mobilon, ≤ 640 px: lenyíló a típus mellett; az „Abbahagyva” csak Sorozatok / Filmek és
  sorozatok típusnál) + Letöltés lenyíló (Összes / Letöltött / Nem letöltött) – Műfaj (csak az
  adott típus műfajai) – Franchise (Összes / Franchise nélkül / a listán használtak, típustól
  függetlenül) – mellette felirat nélküli ↺ gomb („Szűrők alaphelyzetbe”, rámutatva súgó;
  alapállapotban halvány, letiltott). **A szűrők alapállapota** (betöltéskor és a ↺-vel,
  `DEFAULT_FILTERS`, Norbi kérése): Filmek – Megnézendő – Nem letöltött – Összes műfaj –
  Franchise nélkül;
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
  váltásakor 1. oldal (akkor is, ha később ugyanaz a szűrés jön vissza)
- `components/PosterCard.js` – borító (`https://image.tmdb.org/t/p/w342` + `poster_path`),
  állapotcsík, „Letöltve” jelvény; a borítóra kattintva a szerkesztő ablak nyílik (mint a
  ceruzával – Norbi kérése), az IMDb- (vagy TMDB-, ha nincs IMDb ID) adatlapra csak a cím visz
  (halvány aláhúzással), „Hozzáadva: <dátum>” a `created_at` alapján (csak megjelenítés, nem
  szerkeszthető), saját értékelés kis csillagsorként (`StarsDisplay`), ceruza gomb a bal felső
  sarokban → szerkesztő ablak (billentyűzettel / felolvasóval ez a borító-kattintás megfelelője)
- `components/TitleEditor.js` – natív `<dialog>` (fejlécben a leírás): állapot, letöltve, megnézve dátuma
  (`watched_at`, csak „Megnézve” állapotnál; átváltáskor a mai nap), értékelés 10 csillaggal
  (+ „Törlés” link), törlés megerősítéssel (a mobilos borítófalon a borító vagy a ceruza nyitja).
  Az „Abbahagyva” állapot csak sorozatnál választható. Évados
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
  `Watchlist`-ben; `table-layout: fixed`, minden maradék hely a címoszlopé): balra borító +
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
  jobbra sorrendben Letöltve – Állapot – Mama – Értékelés (10 másfélszeres csillag középen,
  mellette „8/10”), a végén törlés megerősítéssel (a sor halvány pirosat kap). Az üres
  Állapot / Mama lenyíló és a kuka csak a sorra mutatva (vagy fókusznál) látszik teljesen
  (`@media (hover: hover)`). Fejléc: kis, ritkított nagybetűs címkék; állapotcsík: lekerekített
  pálca a borító mellett (`td:first-child::before`). Azonnali, optimista mentés (hibánál
  visszaáll). Megjegyzés mező nincs a felületen (Norbi kérésére; a `notes` oszlop megmaradt).
  Évados sorozatnál a Letöltve cellában a letöltött évadok, az Állapot cellában az évadcsík
  (`SeasonDownloads`, `SeasonCell`); a borítókártyán a borító alján évadcsík + „x/y évad”
- `components/FranchiseSelect.js` – franchise lenyíló (üres / meglévők / „+ Új franchise…”
  → helyben névmegadás, Enter: hozzáadás, Esc: mégse / „× „Név” törlése…” a kiválasztottra,
  megerősítéssel, minden címről lekerül); soros nézet és szerkesztő ablak is
- `components/StarRating.js` – `StarRating` (szerkeszthető: rádiógombok, nyilakkal is
  állítható, a kiválasztott csillagra újra kattintva `null`) és `StarsDisplay` (csak kijelzés)
- `lib/useMediaQuery.js` – `useMediaQuery(query)` hook (`useSyncExternalStore`)
- `components/SiteFooter.js` – kötelező TMDB forrásmegjelölés, ne töröld
- `components/TitleSearch.js` – „Cím hozzáadása” panel: késleltetett (400 ms) TMDB keresés,
  találati lista, „Hozzáadás a listához” gomb; a már listán lévőknél „✓ A listán”
- `lib/supabase.js` – Supabase kliens
- `lib/api.js` – `apiGet()`: saját `/api` route hívása `Authorization: Bearer` tokennel,
  hibánál a szerver magyar üzenetével dob
- `lib/titles.js` – címműveletek: `titleKey()`, `addTitle()` (műfajok upsert → `titles`
  insert → `title_genres` insert, hibánál a cím visszavonása), `updateTitle()`,
  `deleteTitle()`, `createFranchise()`, `deleteFranchise()`; a címműveletek a `titles_with_genres` friss sorát adják
  vissza (törlés kivételével). A franchise nevét a kliens keresi ki id alapján (nincs a nézetben).
  Sorozatnál az `addTitle()` az évadokat is felveszi (`title_seasons`, `seasons_checked_at` = most).
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
  sorokat adja vissza. A `Watchlist` betöltéskor hívja
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
- `components/ImdbRatingsImport.js` + `lib/imdbImport.js` – visszafogott „IMDb értékelések”
  gomb a Kilépés mellett, rámutatva súgóval (`.has-hint` + `.hint`, `aria-describedby`):
  az IMDb értékelés-exportjából (CSV: `Const`, `Your Rating`)
  a böngészőben IMDb ID alapján párosít, összefoglalót mutat, majd `applyMyRatings()`
  (csillagértékenként egy update). Norbi döntései: csak a listán lévő címek, az IMDb csillaga
  felülírja a sajátot, az állapot nem változik, új cím nem kerül fel. Teljesen automatikus
  szinkron nincs (az IMDb-nek nincs API-ja, az oldal gépi olvasása tiltott).
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
  tompított, de olvasható szöveg (`--watched-text`, ≥ 4,5:1), halványabb vezérlők – nem az egész
  sor átlátszó. Rámutatáskor, fókusznál és a törlés megerősítésekor minden teljes színű.
- Design: sötét téma a `:root` változókkal; kiemelőszín (`--accent`) neon türkiz `#33e0ef`
  (nem sárga), a „Folyamatban” is ez; állapotszínek `--st-<kód>` változókban (Abbahagyva:
  halvány lila `--st-dropped`).
  Új állapotnál ide is kell egy szín, és a `[data-status=...]` szabály (kártya és táblázatsor is használja).
- Teli türkiz csak a fő műveleteknél (Cím hozzáadása, Mentés, Belépés); a kiválasztott állapot
  (szűrőgomb, aktuális oldal, választott lehetőség) `--accent-soft` háttér + `--accent-line` keret.
  A gombok kerek végűek, rámutatva világosodnak, lenyomva sötétednek (`--accent-hover/-press`,
  `--hover-tint/--press-tint`).
- Saját lenyíló-nyíl (`--chevron`, `appearance: none`) és jelölőnégyzet (`--check-mark`); ahol egy
  szabály `background` rövidítést ad egy lenyílónak, a nyilat is újra meg kell adni. Windows nagy
  kontrasztú módban a beépített vezérlők maradnak.
- Mozgás: legfeljebb ~0,2 s-os átmenetek; a `globals.css` végén egy közös
  `prefers-reduced-motion: reduce` szabály mindet kikapcsolja.
- Hiányzó borító: a `.thumb:empty` / `.poster-fallback` filmikont kap (`--icon-film`).
- A 2026-10-03-i megjelenés-frissítés javaslatai és mérései: `munka/dizajn/` (helyi mappa, lásd
  `munka/README.md`); a 10-es javaslat (álló betűs eredeti cím) Norbi kérésére kimaradt.
- Képekhez sima `<img>`, nem `next/image`.
- Nincs middleware / proxy; az auth kliensoldali.

## Állapot
Kész: adatbázis, projektváz, belépés, lista + szűrők, GitHub, Vercel deploy,
TMDB kereső és hozzáadás (az `/api/tmdb/*` route-ok token nélkül 401-et adnak),
hozzáadás dátuma a kártyán, cím szerkesztése és törlése (`TitleEditor`),
asztali soros nézet soron belüli szerkesztéssel (`TitleTable`), csillagos értékelés,
„Mama” jelző, rendezés (hozzáadás, értékelés, megjelenés éve), letisztított szűrősor,
franchise-ok (beállítás + szűrő + törlés; átnevezés még nincs a felületen), neon türkiz színvilág,
TMDB leírás a cím mellett, IMDb-értékelés (OMDb) + rendezés szerinte, lapozás,
saját IMDb-értékelések betöltése CSV-ből, franchise-logók a szűrőben,
megjelenés-frissítés (18 javaslat, 2026-10-03), keresés a listán, középre zárt belépés,
évadok a sorozatoknál (évadonkénti állapot és letöltve, a sorozat állapota ebből számolódik,
új évadok hetente a TMDB-ről; epizódszintű követés Norbi kérésére nem kell),
„Abbahagyva” állapot sorozatoknál, szűrők alapállapota + ↺ gomb, Letöltés szűrő (Összes /
Letöltött / Nem letöltött), mobilon a borító a szerkesztőt nyitja (az IMDb-re a cím visz),
asztali nézetben lista / rács váltó, telefonon 3 kártya egy sorban,
app-ikon (filmcsapó) és manifest: Norbi asztali alkalmazásként a Chrome-ból telepítette
(Electron-csomag helyett).
Franchise-filmek importja (franchise.xlsx): 194 cím, 34 franchise; hozzáadás dátuma = megjelenés.
Norbi listája (norbert.tutor@gmail.com) 2026-10-02-án Excelből importálva: 512 cím.
Fejléc: „Megnézendő filmek és sorozatok” (a böngészőfül: „Megnézendő filmek”).

## Következő feladat
- Tömeges import (soronként beillesztett címek, bizonytalan találatok jóváhagyása).

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
