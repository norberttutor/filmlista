-- =========================================================
-- Filmlista – 4. lépés: franchise-ok (saját kategóriák, pl. "Star Wars")
-- A 03_mama.sql UTÁN futtasd (SQL Editor → New query → Run)
-- =========================================================


-- ---------- Franchise-ok ----------
-- Felhasználónként saját lista, a felületen bővíthető.
create table public.franchises (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid()
             references auth.users (id) on delete cascade,
  name       text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

-- ugyanaz a név ne szerepeljen kétszer (kis- és nagybetűtől függetlenül)
create unique index franchises_user_name_idx on public.franchises (user_id, lower(name));

alter table public.franchises enable row level security;

create policy "franchises_own" on public.franchises
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.franchises to authenticated;


-- ---------- titles.franchise_id ----------
-- null = nincs franchise (alapértelmezett); ha a franchise törlődik, a cím megmarad
alter table public.titles
  add column franchise_id bigint references public.franchises (id) on delete set null;

create index titles_franchise_idx on public.titles (franchise_id);


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
