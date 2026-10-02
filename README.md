# Filmlista

Megnézendő filmek és sorozatok listája. Next.js + Supabase, Vercelen futtatva.

## 1. Saját felhasználó létrehozása (Supabase)

1. Supabase → **Authentication → Users → Add user → Create new user**.
2. Add meg az e-mail-címed és egy jelszót, és pipáld be az **Auto Confirm User** opciót.
3. Ezután kapcsold ki az új regisztrációkat, hogy idegen ne hozhasson létre fiókot:
   **Authentication → Sign In / Providers → Allow new users to sign up** → kikapcsolva.

## 2. Beállítások

A projekt mappájában másold le a `.env.local.example` fájlt `.env.local` néven, és töltsd ki
a Supabase **Project URL**-lel és a **publishable (anon) key**-jel.
(Supabase → Project Settings → API, újabb felületen: API Keys.)

## 3. Futtatás a saját gépen

```bash
npm install
npm run dev
```

Utána nyisd meg: http://localhost:3000 – és lépj be az 1. pontban létrehozott fiókkal.

## 4. Próbaadat (nem kötelező)

Hogy lásd, hogyan néz ki egy kártya, futtasd ezt a Supabase SQL Editorban:

```sql
insert into public.genres (id, name) values (18, 'Dráma')
on conflict (id) do nothing;

insert into public.titles
  (user_id, media_type, title, original_title, release_year, imdb_id, tmdb_id, status)
select id, 'movie', 'A remény rabjai', 'The Shawshank Redemption', 1994, 'tt0111161', 278, 'to_watch'
from auth.users
limit 1;

insert into public.title_genres (title_id, genre_id)
select id, 18 from public.titles where tmdb_id = 278;
```

Borítókép még nem lesz rajta (azt a TMDB-ből töltjük majd), de a kártya, a szűrők
és az IMDb link már működik. Törlés:

```sql
delete from public.titles where tmdb_id = 278;
```

## 5. Feltöltés GitHubra

GitHubon hozz létre egy új, **privát** repót `filmlista` néven (README nélkül), majd a projekt mappájában:

```bash
git init
git add .
git commit -m "Projektváz"
git branch -M main
git remote add origin https://github.com/FELHASZNALONEV/filmlista.git
git push -u origin main
```

A `.env.local` nem kerül fel, mert benne van a `.gitignore`-ban.

## 6. Indítás Vercelen

1. Vercel → **Add New → Project** → válaszd ki a `filmlista` repót.
2. Az **Environment Variables** részben add hozzá ugyanazt a két változót, mint a `.env.local`-ban:
   `NEXT_PUBLIC_SUPABASE_URL` és `NEXT_PUBLIC_SUPABASE_KEY`.
3. **Deploy**. Pár perc múlva kapsz egy `…vercel.app` címet.

Ezután minden `git push` után a Vercel magától frissíti az oldalt.
