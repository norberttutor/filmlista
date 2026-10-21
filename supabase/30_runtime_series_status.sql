-- =========================================================
-- Filmlista – 30. lépés: játékidő és a sorozat állapota (terv-3 125, 129)
-- A 29_toplists.sql UTÁN futtasd
-- =========================================================
-- Az adatlap adatsorában (Norbi választása, „D” látványterv): filmnél a játékidő, sorozatnál a
-- TMDB szerinti állapot („Folytatódik · eddig 2 évad”, „Elkaszálták az 1. évad után” …) és a legutóbbi
-- rész hossza; Mama adatlapján a film játékideje.
--   runtime       – percben; filmnél a teljes hossz, sorozatnál a legutóbbi rész hossza (a TMDB
--                   episode_run_time mezője szinte mindig üres)
--   series_status – a TMDB status mezője változatlanul ('Returning Series', 'Ended', 'Canceled',
--                   'In Production', 'Planned', 'Pilot'); a magyar feliratot a kliens adja; filmnél üres
-- Felvételkor a /api/tmdb/details tölti, utána a /api/tmdb/seasons (sorozat, hetente) és a
-- /api/tmdb/details-refresh frissíti. NULL-t engednek: a régebbi mentések visszaállításakor üresek
-- maradnak (a következő frissítés pótolja).


-- ---------- Oszlopok ----------
alter table public.titles
  add column runtime smallint check (runtime > 0),
  add column series_status text;


-- ---------- Nézet: a t.* az új oszlopokat csak újralétrehozva adja ----------
drop view public.titles_with_genres;

create view public.titles_with_genres
with (security_invoker = true) as
select
  t.*,
  s.name as status_name,
  coalesce(
    array_agg(g.name order by g.name) filter (where g.id is not null),
    '{}'
  ) as genres,
  coalesce(
    (select jsonb_agg(
              jsonb_build_object(
                'season_number', ts.season_number,
                'name',          ts.name,
                'episode_count', ts.episode_count,
                'air_date',      ts.air_date,
                'status',        ts.status,
                'is_downloaded', ts.is_downloaded,
                'watched_at',    ts.watched_at)
              order by ts.season_number)
       from public.title_seasons ts
      where ts.title_id = t.id),
    '[]'::jsonb
  ) as seasons
from public.titles t
join      public.statuses     s  on s.code = t.status
left join public.title_genres tg on tg.title_id = t.id
left join public.genres       g  on g.id = tg.genre_id
group by t.id, s.name;


-- ---------- Mama listája: a játékidővel (a visszatérési típus változik – újra kell létrehozni) ----------
drop function public.mama_list();

create function public.mama_list()
returns table (
  id             bigint,
  tmdb_id        integer,
  title          text,
  original_title text,
  release_year   smallint,
  poster_path    text,
  backdrop_path  text,
  overview       text,
  imdb_rating    numeric,
  imdb_votes     integer,
  genres         text[],
  mama_status    text,
  created_at     timestamptz,
  runtime        smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.tmdb_id, t.title, t.original_title, t.release_year, t.poster_path,
         t.backdrop_path, t.overview, t.imdb_rating, t.imdb_votes,
         coalesce((select array_agg(g.name order by g.name)
                     from public.title_genres tg
                     join public.genres g on g.id = tg.genre_id
                    where tg.title_id = t.id), '{}'),
         t.mama_status, t.created_at, t.runtime
    from public.list_viewers v
    join public.titles t on t.user_id = v.owner_id
   where v.viewer_id = (select auth.uid())
     and t.media_type = 'movie'
     and (t.mama_status = 'interested'
          or (t.mama_status is null
              and t.status = 'to_watch'
              and t.franchise_id is null
              and public.title_released(t)))
   order by t.created_at desc, t.id desc
$$;
revoke all on function public.mama_list() from public, anon;
grant execute on function public.mama_list() to authenticated;
