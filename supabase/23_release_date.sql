-- =========================================================
-- Filmlista – 23. lépés: pontos megjelenési dátum (terv-3 55)
-- A 22_titles_franchise_check.sql UTÁN futtasd
-- =========================================================
-- A „Legrégebbi / Legújabb megjelenés” rendezés eddig csak az évet nézte, így egy év címei (pl. a
-- Marvelben) összekeveredtek. A mozis / digitális dátum (theatrical_release, digital_release) csak
-- a friss filmeknél van meg, ezért eltároljuk a TMDB elsődleges dátumát is:
--   release_date – filmnél a TMDB release_date, sorozatnál a first_air_date
-- Az új címek felvételkor kapják meg (a details route adja), a meglévőket egyszer, szkripttel
-- töltöttük fel. NULL-t enged: a régebbi mentések visszaállításakor üres marad (a rendezés
-- ilyenkor a többi dátumra / az évre esik vissza).


-- ---------- Oszlop ----------
alter table public.titles
  add column release_date date;


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
