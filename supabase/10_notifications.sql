-- =========================================================
-- Filmlista – 10. lépés: értesítések (új évad)
-- A 09_dropped.sql UTÁN futtasd
-- =========================================================
-- A harang az új évadokról szól: ha egy sorozathoz új, még meg nem jelent évadot jelentenek
-- be (a heti TMDB-frissítés veszi fel – ezt az /api/tmdb/seasons írja be), és amikor egy évad
-- megjelenik (collect_season_notifications(), az app betöltéskor hívja). A sorozat
-- felvételekor már meglévő és a kézzel hozzáadott évadokról nem szól, az abbahagyott
-- sorozatokról sem.


-- ---------- Értesítések ----------
create table public.notifications (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  title_id      bigint not null references public.titles (id) on delete cascade,
  season_number smallint not null,
  kind          text not null check (kind in ('season_announced', 'season_aired')),
  air_date      date,                    -- az évad megjelenése (bejelentettnél lehet üres)
  created_at    timestamptz not null default now(),
  read_at       timestamptz,             -- üres: még nem olvasta
  unique (title_id, season_number, kind) -- egy eseményről egyszer szól
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- csak a saját értesítések (beíráskor a cím is a felhasználóé legyen)
create policy "notifications_own" on public.notifications
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.titles t
                 where t.id = title_id and t.user_id = (select auth.uid()))
  );


-- ---------- Évad: szóltunk-e már a megjelenéséről ----------
-- Új sorként hamis; az app a felvételkor már megjelent és a kézzel felvett évadnál igazra
-- állítja. A már meglévő, megjelent évadokról nem szólunk utólag.
alter table public.title_seasons add column aired_notified boolean not null default false;

update public.title_seasons
   set aired_notified = true
 where air_date <= (now() at time zone 'Europe/Budapest')::date;


-- ---------- Megjelent évadok → értesítés ----------
-- A felhasználó jogaival fut (RLS): csak a saját sorozatai. A még nem jelzett, már megjelent
-- évadokról értesítést ír (az abbahagyott sorozatokról és a már megnézett évadokról nem), és
-- jelzettnek állítja őket.
create or replace function public.collect_season_notifications()
returns void
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Budapest')::date;
begin
  insert into public.notifications (user_id, title_id, season_number, kind, air_date)
  select t.user_id, s.title_id, s.season_number, 'season_aired', s.air_date
    from public.title_seasons s
    join public.titles t on t.id = s.title_id
   where not s.aired_notified
     and s.air_date <= today
     and s.status <> 'watched'
     and t.status <> 'dropped'
  on conflict (title_id, season_number, kind) do nothing;

  update public.title_seasons s
     set aired_notified = true
   where not s.aired_notified
     and s.air_date <= today;
end;
$$;
