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
  „Letöltöttek” jelölő – Műfaj (csak az adott típus műfajai) – Franchise (csak a használtak);
  jobb szélen Rendezés (`SORTS`:
  legutóbb / legkorábban hozzáadott, legjobb értékelés, legújabb / legrégebbi megjelenés;
  üres érték a végére). Az állapotgombok darabszámai a többi szűrőt már figyelembe veszik
- `components/PosterCard.js` – borító (`https://image.tmdb.org/t/p/w342` + `poster_path`),
  állapotcsík, „Letöltve” jelvény, link IMDb-re (vagy TMDB-re, ha nincs IMDb ID),
  „Hozzáadva: <dátum>” a `created_at` alapján (csak megjelenítés, nem szerkeszthető),
  saját értékelés kis csillagsorként (`StarsDisplay`), ceruza gomb a bal felső sarokban → szerkesztő ablak
- `components/TitleEditor.js` – natív `<dialog>`: állapot, letöltve, megnézve dátuma
  (`watched_at`, csak „Megnézve” állapotnál; átváltáskor a mai nap), értékelés 10 csillaggal
  (+ „Törlés” link), megjegyzés, törlés megerősítéssel (a mobilos borítófalon a ceruza nyitja)
- `components/TitleTable.js` – asztali soros nézet (≥ 1400 px, `DESKTOP_QUERY` a
  `Watchlist`-ben; egy mérettel nagyobb betűk): balra borító + adatok (a cím mellett
  Franchise lenyíló, üresen csak rámutatáskor látszik), jobbra sorrendben Letöltve – Állapot –
  Mama – Értékelés (10 másfélszeres csillag + „8/10”) – Megjegyzés (fejléc csak
  képernyőolvasónak), a végén törlés megerősítéssel. Azonnali,
  optimista mentés (hibánál visszaáll). A megjegyzés visszafogott (keret/háttér csak
  rámutatáskor), kikattintáskor ment, Esc-re visszaáll
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
  „Mama” jelző: üres / Érdekli / Megkapta – `03_mama.sql`), `franchise_id` (FK → franchises,
  null = nincs; `on delete set null`), `my_rating` (1–10), `notes`, `watched_at`,
  `created_at`, `updated_at` (trigger); egyedi: `(user_id, media_type, tmdb_id)`
- `franchises (id, user_id default auth.uid(), name, created_at)` – felhasználónkénti saját
  lista, a felületen bővíthető; egyedi: `(user_id, lower(name))` – `04_franchises.sql`
- `title_genres (title_id, genre_id)` – kapcsolótábla
- `titles_with_genres` nézet (`security_invoker`): `titles.*` + `status_name` + `genres text[]`
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
- A megnézett (`watched`) címek halványak (sor és kártya), rámutatáskor teljes fényerő.
- Design: sötét téma a `:root` változókkal; kiemelőszín (`--accent`) neon türkiz `#33e0ef`
  (nem sárga), a „Folyamatban” is ez; állapotszínek `--st-<kód>` változókban.
  Új állapotnál ide is kell egy szín, és a `[data-status=...]` szabály (kártya és táblázatsor is használja).
- Képekhez sima `<img>`, nem `next/image`.
- Nincs middleware / proxy; az auth kliensoldali.

## Állapot
Kész: adatbázis, projektváz, belépés, lista + szűrők, GitHub, Vercel deploy,
TMDB kereső és hozzáadás (az `/api/tmdb/*` route-ok token nélkül 401-et adnak),
hozzáadás dátuma a kártyán, cím szerkesztése és törlése (`TitleEditor`),
asztali soros nézet soron belüli szerkesztéssel (`TitleTable`), csillagos értékelés,
„Mama” jelző, rendezés (hozzáadás, értékelés, megjelenés éve), letisztított szűrősor,
franchise-ok (beállítás + szűrő + törlés; átnevezés még nincs a felületen), neon türkiz színvilág.
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
  Szkriptből (supabase-js) kilépéskor `signOut({ scope: 'local' })` kell – az alapértelmezett
  `global` a böngészőben futó munkamenetet is lezárja, és az `/api` route-ok 401-et adnak.
