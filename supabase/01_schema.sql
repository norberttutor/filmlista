-- =========================================================
-- Filmlista – adatbázis séma (Supabase / PostgreSQL)
-- Futtatás: Supabase → SQL Editor → New query → beillesztés → Run
-- =========================================================


-- ---------- Műfajok ----------
-- Az id a TMDB műfaj-azonosítója, így a TMDB-ből jövő adatok
-- közvetlenül, átalakítás nélkül illeszthetők.
create table public.genres (
  id   integer primary key,
  name text    not null
);


-- ---------- Filmek és sorozatok ----------
create table public.titles (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid()
                 references auth.users (id) on delete cascade,
  media_type     text not null check (media_type in ('movie', 'tv')),  -- film / sorozat
  title          text not null,          -- magyar cím (ha van), egyébként az elérhető cím
  original_title text,                   -- eredeti cím
  release_year   smallint,
  overview       text,                   -- rövid leírás
  poster_path    text,                   -- TMDB képútvonal, pl. /abc123.jpg
  tmdb_id        integer,
  imdb_id        text check (imdb_id ~ '^tt[0-9]+$'),  -- pl. tt0111161
  status         text not null default 'to_watch'
                 check (status in ('to_watch', 'watching', 'watched')),
                 -- to_watch = megnézendő, watching = folyamatban, watched = megnézve
  my_rating      smallint check (my_rating between 1 and 10),  -- saját értékelés
  notes          text,                   -- saját megjegyzés
  watched_at     date,                   -- mikor nézted meg
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- ugyanaz a film/sorozat ne kerüljön fel kétszer
  unique (user_id, media_type, tmdb_id)
);

create index titles_user_status_idx on public.titles (user_id, status);


-- ---------- Kapcsolótábla: cím ↔ műfaj ----------
create table public.title_genres (
  title_id bigint  not null references public.titles (id) on delete cascade,
  genre_id integer not null references public.genres (id),
  primary key (title_id, genre_id)
);

create index title_genres_genre_idx on public.title_genres (genre_id);


-- ---------- updated_at automatikus frissítése ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger titles_set_updated_at
before update on public.titles
for each row execute function public.set_updated_at();


-- ---------- Jogosultságok (Row Level Security) ----------
-- Bekapcsolás nélkül bárki elérné az adatokat, aki ismeri a projekt kulcsát.
alter table public.genres       enable row level security;
alter table public.titles       enable row level security;
alter table public.title_genres enable row level security;

-- Műfajlista: bejelentkezett felhasználó olvashatja és bővítheti
create policy "genres_select" on public.genres
  for select to authenticated using (true);

create policy "genres_insert" on public.genres
  for insert to authenticated with check (true);

create policy "genres_update" on public.genres
  for update to authenticated using (true) with check (true);

-- Címek: mindenki csak a saját sorait látja és kezeli
create policy "titles_own" on public.titles
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Műfaj-hozzárendelés: csak saját címekhez
create policy "title_genres_own" on public.title_genres
  for all to authenticated
  using (exists (
    select 1 from public.titles t
    where t.id = title_genres.title_id
      and t.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.titles t
    where t.id = title_genres.title_id
      and t.user_id = (select auth.uid())
  ));


-- ---------- Kényelmi nézet: címek a műfajaikkal együtt ----------
-- security_invoker: a nézet is a fenti jogosultságok szerint működik
create view public.titles_with_genres
with (security_invoker = true) as
select
  t.*,
  coalesce(
    array_agg(g.name order by g.name) filter (where g.id is not null),
    '{}'
  ) as genres
from public.titles t
left join public.title_genres tg on tg.title_id = t.id
left join public.genres       g  on g.id = tg.genre_id
group by t.id;
