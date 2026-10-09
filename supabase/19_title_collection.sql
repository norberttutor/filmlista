-- =========================================================
-- Filmlista – 19. lépés: a filmek TMDB-gyűjteménye (franchise-javaslathoz, terv-3 35)
-- A 18_notification_dismiss.sql UTÁN futtasd
-- =========================================================
-- Filmenként eltároljuk, melyik TMDB-gyűjteménybe tartozik (belongs_to_collection) – ebből a
-- böngésző a betöltött listából, további lekérés nélkül tudja, hogy egy franchise nélküli film
-- egy franchise-od gyűjteményébe tartozik-e (a franchise filmjeinek gyűjteményei + a kézzel
-- hozzárendeltek). Az új filmek felvételkor kapják meg (a details route adja), a meglévőket a
-- /api/tmdb/title-collections tölti ki a háttérben.
--   tmdb_collection_id       – a TMDB-gyűjtemény azonosítója (null: nincs / még nem néztük)
--   collection_checked_at    – mikor néztük meg a TMDB-n
--   franchise_suggestion_off – a felajánlott franchise-t elutasította („Nem kell”): többé nem
--                              javasoljuk
-- Mind NULL-t enged: a régebbi mentések visszaállításakor üresek maradnak (a háttér pótolja).


-- ---------- Oszlopok ----------
alter table public.titles
  add column tmdb_collection_id integer,
  add column collection_checked_at timestamptz,
  add column franchise_suggestion_off boolean;


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
