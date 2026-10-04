# Filmlista

Megnézendő filmek és sorozatok személyes listája: borító, műfajok, állapot, letöltve jelző,
évadok, saját és IMDb-értékelés, franchise-ok, értesítés az új évadokról.
Next.js + Supabase, Vercelen futtatva: https://filmlista-six.vercel.app/

A részletes leírás (felépítés, adatbázis, konvenciók): `CLAUDE.md`.

## Újratelepítés lépései

### 1. Adatbázis (Supabase)

1. Supabase → **SQL Editor**: futtasd le a `supabase/` mappa fájljait sorrendben
   (`01_schema.sql` … `11_backdrop.sql`).
2. **Authentication → Users → Add user → Create new user**: e-mail-cím, jelszó, és pipáld be az
   **Auto Confirm User** opciót.
3. Kapcsold ki az új regisztrációkat, hogy idegen ne hozhasson létre fiókot:
   **Authentication → Sign In / Providers → Allow new users to sign up** → kikapcsolva.

### 2. Beállítások

A projekt mappájában másold le a `.env.local.example` fájlt `.env.local` néven, és töltsd ki
(a fájlban le van írva, melyik érték honnan jön):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY` – Supabase → Project Settings → API Keys
- `TMDB_READ_TOKEN` – a film- és sorozatadatokhoz (themoviedb.org → Settings → API)
- `OMDB_API_KEY` – az IMDb-értékelésekhez (nem kötelező)

### 3. Futtatás a saját gépen

```bash
npm install
npm run dev
```

Utána nyisd meg: http://localhost:3000 – és lépj be az 1. pontban létrehozott fiókkal.

### 4. Vercel

1. Vercel → **Add New → Project** → válaszd ki a `filmlista` repót.
2. **Settings → Environment Variables**: ugyanaz a négy változó, mint fent
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`, `TMDB_READ_TOKEN`, `OMDB_API_KEY`).
   A tesztfiók és az adatbázis-cím (`TEST_USER_*`, `SUPABASE_DB_URL`) csak helyben kell, a
   Vercelre ne kerüljön.
3. **Deploy**. Ezután minden `git push` után a Vercel magától frissíti az oldalt, és naponta
   egyszer ébren tartja a Supabase-projektet (`vercel.json`).
