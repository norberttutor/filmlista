-- =========================================================
-- Filmlista – 3. lépés: "Mama" jelző
-- A 02_statuses_downloaded.sql UTÁN futtasd (SQL Editor → New query → Run)
-- =========================================================


-- ---------- Mama ----------
-- null = nincs megadva (alapértelmezett), interested = érdekli, received = megkapta
alter table public.titles
  add column mama_status text
  check (mama_status in ('interested', 'received'));


-- ---------- Nézet újralétrehozása ----------
-- A nézet létrehozáskor rögzíti az oszloplistát (t.*), ezért az új mező
-- csak újralétrehozás után jelenik meg benne.
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
