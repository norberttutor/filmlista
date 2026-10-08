-- =========================================================
-- Filmlista – 20. lépés: megosztható nézési sorrend (terv-3 41)
-- A 19_title_collection.sql UTÁN futtasd
-- =========================================================
-- Egy franchise nézési sorrendjéhez csak olvasható nyilvános link (/sorrend/<token>): belépés
-- nélkül nyílik, a címekkel, évadokkal és borítókkal – a megnézett állapot, az értékelések, a
-- letöltve jelző és a Mama-jelölés nélkül. Franchise-onként legfeljebb egy link; a visszavonás a
-- sor törlése (utána egy új link már más tokent kap, a régi többé nem nyílik meg).
-- Nincs a mentésben (beállítás, nem lista-adat – mint a list_viewers). A visszaállítás a
-- franchise-okat törli és újratölti, ezért a linkek ilyenkor kaszkádban megszűnnek.


-- ---------- Tábla ----------
create table public.franchise_shares (
  franchise_id bigint      primary key references public.franchises (id) on delete cascade,
  user_id      uuid        not null default auth.uid()
               references auth.users (id) on delete cascade,
  -- 32 hexa jegy (122 véletlen bit): kitalálhatatlan
  token        text        not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at   timestamptz not null default now()
);

create index franchise_shares_user_idx on public.franchise_shares (user_id);

alter table public.franchise_shares enable row level security;

-- csak a sajátját látja / hozza létre / vonja vissza; a franchise is a felhasználóé legyen
create policy "franchise_shares_own" on public.franchise_shares
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.franchises f
                 where f.id = franchise_id and f.user_id = (select auth.uid()))
  );


-- ---------- A megosztott sorrend (belépés nélkül) ----------
-- A token alapján a franchise neve, logója, háttérképe (a legjobb IMDb-értékelésű, háttérképes
-- cím jelenetképe – mint a franchiseBackdrop()), a franchise címei (évadokkal) és a tárolt
-- sorrend. Csak a megjelenítéshez kellő oszlopok: állapot, értékelés, letöltve, Mama, megjegyzés,
-- user_id soha. A sorba rendezés a kliens dolga (lib/watchOrder.js – ugyanaz, mint az appban).
-- Érvénytelen / visszavont tokenre null.
create or replace function public.shared_watch_order(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', f.name,
    'logo_path', f.logo_path,
    'backdrop_path', (
      select t.backdrop_path
        from public.titles t
       where t.franchise_id = f.id and t.user_id = f.user_id and t.backdrop_path is not null
       order by t.imdb_rating desc nulls last, t.imdb_votes desc nulls last, t.id
       limit 1),
    'titles', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', t.id,
               'media_type', t.media_type,
               'tmdb_id', t.tmdb_id,
               'title', t.title,
               'release_year', t.release_year,
               'poster_path', t.poster_path,
               'theatrical_release', t.theatrical_release,
               'digital_release', t.digital_release,
               'seasons', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'season_number', s.season_number,
                          'air_date', s.air_date,
                          'episode_count', s.episode_count)
                        order by s.season_number)
                   from public.title_seasons s
                  where s.title_id = t.id), '[]'))
             order by t.id)
        from public.titles t
       where t.franchise_id = f.id and t.user_id = f.user_id), '[]'),
    'order', coalesce((
      select jsonb_agg(jsonb_build_object(
               'title_id', o.title_id,
               'season_number', o.season_number,
               'position', o.position)
             order by o.position)
        from public.franchise_order o
       where o.franchise_id = f.id), '[]')
  )
    from public.franchise_shares sh
    join public.franchises f on f.id = sh.franchise_id and f.user_id = sh.user_id
   where p_token ~ '^[0-9a-f]{32}$'
     and sh.token = p_token
$$;

revoke all on function public.shared_watch_order(text) from public;
grant execute on function public.shared_watch_order(text) to anon, authenticated;
