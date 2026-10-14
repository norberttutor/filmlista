-- =========================================================
-- Filmlista – 26. lépés: frissítés a TMDB-ről (terv-3 83)
-- A 25_realtime.sql UTÁN futtasd
-- =========================================================
-- A bejelentett / friss filmek magyar címe, leírása, borítója gyakran csak később kerül a TMDB-re –
-- a felvételkori adat eddig örökre megmaradt. A háttérfrissítés (/api/tmdb/details-refresh,
-- lib/refreshDue.js detailsDue) a meg nem nézett címeket havonta, a még meg nem jelenteket hetente
-- nézi meg; az adatlapon kézzel is („Frissítés a TMDB-ről”).
--   details_checked_at – mikor néztük meg utoljára (üres: a felvétel ideje számít)
-- NULL-t enged: a régebbi mentések visszaállításakor üres marad.


-- ---------- Oszlop ----------
alter table public.titles
  add column details_checked_at timestamptz;


-- ---------- Nézet: a t.* az új oszlopot csak újralétrehozva adja ----------
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
