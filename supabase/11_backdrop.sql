-- =========================================================
-- Filmlista – 11. lépés: háttérkép (TMDB backdrop) a szerkesztő ablakhoz
-- A 10_notifications.sql UTÁN futtasd
-- =========================================================
-- A szerkesztő ablak tetején a film széles jelenetképe látszik. Az új címek felvételkor kapják
-- meg (a /api/tmdb/details adja), a meglévőket a /api/tmdb/backdrops tölti fel a háttérben,
-- adagonként, a felhasználó jogaival. A backdrop_checked_at jelzi, hogy már megnéztük (ha a
-- TMDB-n nincs háttérkép, ne kérdezzük újra és újra).

alter table public.titles
  add column if not exists backdrop_path       text,
  add column if not exists backdrop_checked_at timestamptz;


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
