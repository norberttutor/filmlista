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

Soha ne használd a Supabase secret/service_role kulcsot a kliensben.

## Fájlszerkezet
- `app/layout.js` – Bricolage Grotesque betűtípus (`--font-main`), `lang="hu"`
- `app/page.js` – kliensoldali session-kezelés: belépés vagy lista
- `components/LoginForm.js` – e-mail + jelszó belépés (regisztráció nincs, ki van kapcsolva)
- `components/Watchlist.js` – lista betöltése a `titles_with_genres` nézetből; szűrősor
  balról: Típus lenyíló (Filmek / Sorozatok, alapból Filmek, nincs „Mind”) – állapotgombok +
  „Letöltöttek” jelölő – Műfaj (csak az adott típus műfajai); jobb szélen Rendezés (`SORTS`:
  legutóbb / legkorábban hozzáadott, legjobb értékelés, legújabb / legrégebbi megjelenés;
  üres érték a végére). Az állapotgombok darabszámai a többi szűrőt már figyelembe veszik
- `components/PosterCard.js` – borító (`https://image.tmdb.org/t/p/w342` + `poster_path`),
  állapotcsík, „Letöltve” jelvény, link IMDb-re (vagy TMDB-re, ha nincs IMDb ID),
  „Hozzáadva: <dátum>” a `created_at` alapján (csak megjelenítés, nem szerkeszthető),
  saját értékelés kis csillagsorként (`StarsDisplay`), ceruza gomb a bal felső sarokban → szerkesztő ablak
- `components/TitleEditor.js` – natív `<dialog>`: állapot, letöltve, megnézve dátuma
  (`watched_at`, csak „Megnézve” állapotnál; átváltáskor a mai nap), értékelés 10 csillaggal
  (+ „Törlés” link), megjegyzés, törlés megerősítéssel (a mobilos borítófalon a ceruza nyitja)
- `components/TitleTable.js` – asztali soros nézet (≥ 1200 px, `DESKTOP_QUERY` a
  `Watchlist`-ben): balra borító + adatok, jobbra sorrendben Letöltve – Mama – Állapot –
  Értékelés (10 csillag + „8/10”) – Megjegyzés, a végén törlés megerősítéssel. Azonnali,
  optimista mentés (hibánál visszaáll). A megjegyzés visszafogott (keret/háttér csak
  rámutatáskor), kikattintáskor ment, Esc-re visszaáll
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
  `deleteTitle()`; mindegyik a `titles_with_genres` friss sorát adja vissza (törlés kivételével).
  Közös segédek: `externalLink()`, `formatDate()`, `todayDate()`, `DEFAULT_STATUS`,
  `MAMA_OPTIONS`, `mamaLabel()`
- `lib/server/auth.js` – `getUserFromRequest()` + `unauthorized()` (csak route handlerben)
- `lib/server/tmdb.js` – `tmdbFetch()`, `tmdbErrorResponse()`, `yearOf()` (csak route handlerben)
- `app/api/tmdb/search/route.js` – `GET ?q=` → `search/multi`, csak film/sorozat
- `app/api/tmdb/details/route.js` – `GET ?type=movie|tv&id=` → a `titles` oszlopainak
  megfelelő objektum + `genres [{id, name}]`; magyar leírás híján angol
- `supabase/*.sql` – a már lefuttatott adatbázis-szkriptek (dokumentáció)

## Adatbázis (már létezik, lásd `supabase/`)
- `genres (id integer PK = TMDB műfaj ID, name)` – bejelentkezve olvasható/írható
- `statuses (code PK, name, sort_order)` – kódok: `to_watch`, `watching`, `watched`
- `titles` – `user_id` (default `auth.uid()`), `media_type` ('movie' | 'tv'), `title`,
  `original_title`, `release_year`, `overview`, `poster_path`, `tmdb_id`, `imdb_id`,
  `status` (FK → statuses), `is_downloaded`, `mama_status` (null | 'interested' | 'received',
  „Mama” jelző: üres / Érdekli / Megkapta – `03_mama.sql`), `my_rating` (1–10), `notes`,
  `watched_at`, `created_at`, `updated_at` (trigger); egyedi: `(user_id, media_type, tmdb_id)`
- `title_genres (title_id, genre_id)` – kapcsolótábla
- `titles_with_genres` nézet (`security_invoker`): `titles.*` + `status_name` + `genres text[]`
- Minden táblán RLS: a felhasználó csak a saját címeit látja/módosítja.
- Sémamódosításnál új számozott SQL fájlt írj a `supabase/` mappába (pl. `03_...sql`),
  amit Norbi a Supabase SQL Editorban futtat. Ha a nézet oszlopai változnak, újra kell
  létrehozni (`drop view` + `create view`).

## Konvenciók
- Felületi szövegek magyarul, mondatkezdő nagybetűvel, cselekvő igékkel
  (pl. „Hozzáadás a listához”, nem „Submit”).
- Hibaüzenet mondja meg, mi a baj és mit tegyen a felhasználó.
- Az alapállapot (`to_watch`, `DEFAULT_STATUS`) a felületen **üresen** jelenik meg: nincs
  „Megnézendő” felirat a soron/kártyán/ablakban, és nincs színe. Csak a szűrőgomb nevezi meg.
  A szerkesztő ablakban a kiválasztott állapotra/Mamára újra kattintva lesz üres.
- A megnézett (`watched`) címek halványak (sor és kártya), rámutatáskor teljes fényerő.
- Design: sötét téma a `:root` változókkal; állapotszínek `--st-<kód>` változókban.
  Új állapotnál ide is kell egy szín, és a `[data-status=...]` szabály (kártya és táblázatsor is használja).
- Képekhez sima `<img>`, nem `next/image`.
- Nincs middleware / proxy; az auth kliensoldali.

## Állapot
Kész: adatbázis, projektváz, belépés, lista + szűrők, GitHub, Vercel deploy,
TMDB kereső és hozzáadás (az `/api/tmdb/*` route-ok token nélkül 401-et adnak),
hozzáadás dátuma a kártyán, cím szerkesztése és törlése (`TitleEditor`),
asztali soros nézet soron belüli szerkesztéssel (`TitleTable`), csillagos értékelés,
„Mama” jelző, rendezés (hozzáadás, értékelés, megjelenés éve), letisztított szűrősor.
Fejléc: „Megnézendő filmek”.

## Következő feladat
- Tömeges import (soronként beillesztett címek, bizonytalan találatok jóváhagyása).
- Sorozatoknál a nézett epizód követése (külön tábla).

## Fejlesztői megjegyzés
- Ha a terminál nem ismeri a `node`/`npm` parancsot, a VS Code-ot újra kell indítani
  (a Node a `C:\Program Files\nodejs` mappában van).
- Tesztfelhasználó: `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` a `.env.local`-ban – külön
  Supabase-fiók, az RLS miatt Norbi listáját nem látja. Soha ne írd ki az értékeit.
  Böngészős teszt: `playwright-core` a scratchpadbe telepítve (nem a projektbe), a gépen
  lévő Chrome-mal (`C:\Program Files\Google\Chrome\Application\chrome.exe`), a helyben
  futó `npx next start -p 3123` ellen. A teszt végén a tesztfiók listáját ürítsd ki.
