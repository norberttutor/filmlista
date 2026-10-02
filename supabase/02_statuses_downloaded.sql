-- =========================================================
-- Filmlista – 2. lépés: állapotok táblája + "letöltve" mező
-- Az 01_schema.sql UTÁN futtasd (SQL Editor → New query → Run)
-- =========================================================


-- ---------- Állapotok (bővíthető lista) ----------
create table public.statuses (
  code       text     primary key,   -- belső kód, az app ezt tárolja
  name       text     not null,      -- megjelenített magyar név
  sort_order smallint not null       -- sorrend a felületen
);

insert into public.statuses (code, name, sort_order) values
  ('to_watch', 'Megnézendő',  1),
  ('watching', 'Folyamatban', 2),
  ('watched',  'Megnézve',    3);

-- Új állapot később, például:
-- insert into public.statuses (code, name, sort_order) values ('dropped', 'Abbahagyva', 4);

alter table public.statuses enable row level security;

create policy "statuses_select" on public.statuses
  for select to authenticated using (true);


-- ---------- titles.status: fix lista helyett hivatkozás ----------
alter table public.titles drop constraint titles_status_check;

alter table public.titles
  add constraint titles_status_fkey
  foreign key (status) references public.statuses (code)
  on update cascade;


-- ---------- Letöltve ----------
alter table public.titles
  add column is_downloaded boolean not null default false;

create index titles_user_downloaded_idx on public.titles (user_id, is_downloaded);


-- ---------- Nézet újralétrehozása ----------
-- A nézet létrehozáskor rögzíti az oszloplistát, ezért az új mező
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
