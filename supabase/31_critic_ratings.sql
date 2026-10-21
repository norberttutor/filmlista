-- =========================================================
-- Filmlista – 31. lépés: Rotten Tomatoes és Metacritic (terv-3 127)
-- A 30_runtime_series_status.sql UTÁN futtasd
-- =========================================================
-- Az IMDb mellett a kritikusok két száma az adatlapon és az asztali listán (Norbi választása, „A”
-- látványterv: a szám a skála színével). Mama nem látja (a mama_list() nem változik).
--   rt_rating – Rotten Tomatoes, a kritikusok hány %-a ajánlja (0–100)
--   mc_rating – Metacritic, a kritikusok pontszámának átlaga (0–100)
-- Az OMDb ugyanabban a válaszban adja, mint az IMDb-értékelést (Ratings tömb): felvételkor a
-- /api/tmdb/details, utána a 14 naponkénti /api/imdb/refresh tölti. Sorozatnál gyakran nincs.
-- NULL-t engednek: a régebbi mentések visszaállításakor üresek maradnak (a következő frissítés pótolja).


-- ---------- Oszlopok ----------
alter table public.titles
  add column rt_rating smallint check (rt_rating between 0 and 100),
  add column mc_rating smallint check (mc_rating between 0 and 100);


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
