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
- `components/Watchlist.js` – lista betöltése a `titles_with_genres` nézetből, szűrők
  (állapot, típus, műfaj, csak letöltöttek)
- `components/PosterCard.js` – borító (`https://image.tmdb.org/t/p/w342` + `poster_path`),
  állapotcsík, „Letöltve” jelvény, link IMDb-re (vagy TMDB-re, ha nincs IMDb ID)
- `components/SiteFooter.js` – kötelező TMDB forrásmegjelölés, ne töröld
- `lib/supabase.js` – Supabase kliens
- `supabase/*.sql` – a már lefuttatott adatbázis-szkriptek (dokumentáció)

## Adatbázis (már létezik, lásd `supabase/`)
- `genres (id integer PK = TMDB műfaj ID, name)` – bejelentkezve olvasható/írható
- `statuses (code PK, name, sort_order)` – kódok: `to_watch`, `watching`, `watched`
- `titles` – `user_id` (default `auth.uid()`), `media_type` ('movie' | 'tv'), `title`,
  `original_title`, `release_year`, `overview`, `poster_path`, `tmdb_id`, `imdb_id`,
  `status` (FK → statuses), `is_downloaded`, `my_rating` (1–10), `notes`, `watched_at`,
  `created_at`, `updated_at` (trigger); egyedi: `(user_id, media_type, tmdb_id)`
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
- Design: sötét téma a `:root` változókkal; állapotszínek `--st-<kód>` változókban.
  Új állapotnál ide is kell egy szín, és a `.card[data-status=...]` szabály.
- Képekhez sima `<img>`, nem `next/image`.
- Nincs middleware / proxy; az auth kliensoldali.

## Állapot
Kész: adatbázis, projektváz, belépés, lista + szűrők, GitHub, Vercel deploy.

## Következő feladat: TMDB kereső és hozzáadás
1. Route handler (pl. `app/api/tmdb/search/route.js`): TMDB `search/multi`, `hu-HU`,
   csak `movie` és `tv` találatok, rövidített válasz (id, típus, cím, eredeti cím, év, poster_path).
   Védelem: a kliens küldje a Supabase access tokent `Authorization: Bearer` fejlécben,
   a route ellenőrizze (`supabase.auth.getUser(token)`), különben 401.
2. Részletek route: `movie/{id}` vagy `tv/{id}` `append_to_response=external_ids`
   → IMDb ID, műfajok (magyar név), leírás.
3. Felület: kereső mező + találati lista borítóval; „Hozzáadás a listához” gomb.
   Mentés: műfajok upsert a `genres`-be → `titles` insert → `title_genres` insert.
   Duplikáció (Postgres `23505`): „Ez a cím már a listádon van.”
   Mentés után frissüljön a lista oldalfrissítés nélkül.
4. Utána: állapot és „letöltve” módosítása a kártyán, törlés, saját értékelés/megjegyzés.
5. Később: tömeges import (soronként beillesztett címek, bizonytalan találatok jóváhagyása),
   sorozatoknál a nézett epizód követése (külön tábla).
