-- =========================================================
-- Filmlista – 33. lépés: hol nézhető a cím (terv-3 144, streaming-szolgáltató szűrő)
-- A 32_shared_tables_viewers.sql UTÁN futtasd
-- =========================================================
-- A fő lista „Hol nézhető?” szűrőjéhez (Norbi választása: „A” lenyíló). A cím magyarországi
-- streamingszolgáltatói a TMDB-ről (forrása a JustWatch): előfizetéses + ingyenes + reklámos
-- (flatrate + free + ads; kölcsönzés / vásárlás nem). Felvételkor a /api/tmdb/details, utána a
-- /api/tmdb/watch-providers tölti (megnézendőnél hetente, megnézettnél havonta – lib/refreshDue.js).
--   watch_providers      – a TMDB szolgáltató-azonosítói (az „… Amazon Channel” változat a fő
--                          szolgáltatóé – lib/providers.js); üres tömb: egyiken sem; NULL: még nem néztük
--   providers_checked_at – az utolsó ellenőrzés
-- NULL-t engednek: a régebbi mentések visszaállításakor üresek maradnak (a következő frissítés pótolja).
-- Mama nem látja (a mama_list() nem változik); a mentés (backup_snapshot) a t.*-gal együtt viszi.


-- ---------- Oszlopok ----------
alter table public.titles
  add column watch_providers integer[],
  add column providers_checked_at timestamptz;


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
