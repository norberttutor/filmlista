-- =========================================================
-- Filmlista – 24. lépés: a megosztott nézési sorrend a franchise színében (terv-3 52.3)
-- A 23_release_date.sql UTÁN futtasd
-- =========================================================
-- A shared_watch_order() két új mezőt ad (a többi változatlan):
--   poster_path            – a franchise színének borítója (a legjobb IMDb-értékelésű, borítós cím;
--                            a böngésző ebből számolja a színt, mint az appban)
--   titles[].release_date  – a pontos megjelenési dátum (23_release_date.sql): a megosztott oldal
--                            sorrendje így ugyanaz, mint az appban (lib/titles.js releaseKey)
-- Állapot, értékelés, letöltve, Mama, megjegyzés, user_id továbbra sem kerül bele.

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
    -- a franchise színének borítója (terv-3 52.3): a legjobb IMDb-értékelésű, borítós címé – mint az
    -- appban a franchisePosterPath()
    'poster_path', (
      select t.poster_path
        from public.titles t
       where t.franchise_id = f.id and t.user_id = f.user_id and t.poster_path is not null
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
               'release_date', t.release_date,
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
