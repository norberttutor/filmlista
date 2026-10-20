-- =========================================================
-- Filmlista – 29. lépés: toplisták (terv-3 120)
-- A 28_client_errors.sql UTÁN futtasd
-- =========================================================
-- A ⋮ „Toplisták” ablak (a legjobb filmek és sorozatok IMDb-értékelés szerint) két közös – nem
-- felhasználóhoz kötött – táblája:
--   * imdb_ratings: az OMDb-ről lekért IMDb-értékelések gyorsítótára (30 napig érvényes – ezt a
--     szerver dönti el a checked_at alapján). Az OMDb ingyenes kerete napi 1000 kérés, közös az app
--     saját IMDb-frissítésével; a toplisták naponta legfeljebb 400-at használnak (imdb_ratings_today()).
--   * toplists: a kész listák (kulcs: 'movie:all', 'tv:gems' …), hogy ne kelljen minden
--     megnyitáskor újra összerakni őket (a Vercel szerverpéldányának memóriája nem tartós).
-- Olvasni minden belépett felhasználó tud, írni csak a lenti függvények. Nincs a mentésben (bármikor
-- újra összeállítható), nincs a Realtime-ban.


create table public.imdb_ratings (
  imdb_id    text        primary key check (imdb_id ~ '^tt[0-9]{5,10}$'),
  rating     numeric(3, 1) check (rating between 0 and 10),    -- null: az IMDb-n nincs értékelése
  votes      integer       check (votes >= 0),
  checked_at timestamptz not null default now()
);

create index imdb_ratings_checked_idx on public.imdb_ratings (checked_at);

create table public.toplists (
  key      text        primary key check (key ~ '^(movie|tv):(all|recent|gems)$'),
  items    jsonb       not null check (jsonb_typeof(items) = 'array'),
  complete boolean     not null default true,   -- hamis: az OMDb napi kerete elfogyott, holnap újra
  built_at timestamptz not null default now()
);

alter table public.imdb_ratings enable row level security;
alter table public.toplists enable row level security;

create policy "imdb_ratings_read" on public.imdb_ratings
  for select to authenticated
  using (true);

create policy "toplists_read" on public.toplists
  for select to authenticated
  using (true);

revoke insert, update, delete on public.imdb_ratings from anon, authenticated;
revoke insert, update, delete on public.toplists from anon, authenticated;
revoke all on public.imdb_ratings from anon;
revoke all on public.toplists from anon;


-- az OMDb-ről most lekért értékelések: [{ imdb_id, rating, votes }] (a rating / votes lehet null)
create or replace function public.store_imdb_ratings(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return;
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'Érvénytelen értékelés-lista.';
  end if;
  insert into public.imdb_ratings (imdb_id, rating, votes, checked_at)
  select x ->> 'imdb_id',
         round((x ->> 'rating')::numeric, 1),
         (x ->> 'votes')::integer,
         now()
    from jsonb_array_elements(p_items) as x
   where x ->> 'imdb_id' ~ '^tt[0-9]{5,10}$'
  on conflict (imdb_id) do update
     set rating = excluded.rating, votes = excluded.votes, checked_at = excluded.checked_at;
end;
$$;

-- a kész lista (legfeljebb 400 cím)
create or replace function public.store_toplist(p_key text, p_items jsonb, p_complete boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return;
  end if;
  if p_key !~ '^(movie|tv):(all|recent|gems)$' or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) > 400 or octet_length(p_items::text) > 1000000 then
    raise exception 'Érvénytelen toplista.';
  end if;
  insert into public.toplists (key, items, complete, built_at)
  values (p_key, p_items, coalesce(p_complete, false), now())
  on conflict (key) do update
     set items = excluded.items, complete = excluded.complete, built_at = excluded.built_at;
end;
$$;

-- ma (budapesti idő szerint) ennyi értékelést kértek le az OMDb-ről a toplistákhoz
create or replace function public.imdb_ratings_today()
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
    from public.imdb_ratings
   where checked_at >= (date_trunc('day', now() at time zone 'Europe/Budapest') at time zone 'Europe/Budapest');
$$;

revoke all on function public.store_imdb_ratings(jsonb) from public, anon;
revoke all on function public.store_toplist(text, jsonb, boolean) from public, anon;
revoke all on function public.imdb_ratings_today() from public, anon;
grant execute on function public.store_imdb_ratings(jsonb) to authenticated;
grant execute on function public.store_toplist(text, jsonb, boolean) to authenticated;
grant execute on function public.imdb_ratings_today() to authenticated;
