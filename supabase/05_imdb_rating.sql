-- =========================================================
-- Filmlista – 5. lépés: IMDb-értékelés (OMDb API-ból)
-- A 04_franchises.sql UTÁN futtasd
-- =========================================================


-- ---------- IMDb-értékelés ----------
-- Hozzáadáskor és utána rendszeresen (14 naponta) frissíti az app, szerveroldalon.
-- imdb_rating_updated_at: az utolsó sikeres lekérdezés ideje (akkor is, ha nincs még értékelés)
alter table public.titles
  add column imdb_rating            numeric(3,1) check (imdb_rating between 0 and 10),
  add column imdb_votes             integer      check (imdb_votes >= 0),
  add column imdb_rating_updated_at timestamptz;


-- ---------- Nézet újralétrehozása ----------
-- A nézet létrehozáskor rögzíti az oszloplistát (t.*), ezért az új mezők
-- csak újralétrehozás után jelennek meg benne.
drop view public.titles_with_genres;

create view public.titles_with_genres
with (security_invoker = true) as
select
  t.*,
  s.name as status_name,
  coalesce(
    array_agg(g.name order by g.name) filter (where g.id is not null),
    '{}'
  ) as genres
from public.titles t
join      public.statuses     s  on s.code = t.status
left join public.title_genres tg on tg.title_id = t.id
left join public.genres       g  on g.id = tg.genre_id
group by t.id, s.name;
