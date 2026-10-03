-- =========================================================
-- Filmlista – 8. lépés: évadok a sorozatokhoz
-- A 07_franchise_logo.sql UTÁN futtasd
-- =========================================================
-- Sorozatoknál évadonként jelölhető az állapot és a "Letöltve". A sorozat állapota,
-- "Letöltve" jelzője és megnézési dátuma az évadokból számolódik (trigger), így a szűrők,
-- darabszámok változatlanul a titles táblából dolgoznak. Évadok nélküli sorozatnál (és
-- filmeknél) minden marad a régi, kézi módon.
-- A TMDB "0. évad" (különkiadások) nem kerül fel. A bejelentett, még meg nem jelent évad
-- air_date-je üres vagy jövőbeli: nem jelölhető, és nem számít a "minden évad megnézve"
-- feltételbe.


-- ---------- Évadok ----------
create table public.title_seasons (
  title_id      bigint not null references public.titles (id) on delete cascade,
  season_number smallint not null check (season_number >= 1),
  user_id       uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  name          text,                    -- TMDB évadnév, pl. "2. évad"
  episode_count smallint check (episode_count >= 0),
  air_date      date,                    -- üres / jövőbeli: bejelentett, még nem jelent meg
  status        text not null default 'to_watch'
                references public.statuses (code),
  is_downloaded boolean not null default false,
  watched_at    date,                    -- mikor lett megnézett (automatikus)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (title_id, season_number)
);

create index title_seasons_user_idx on public.title_seasons (user_id);

create trigger title_seasons_set_updated_at
before update on public.title_seasons
for each row execute function public.set_updated_at();

alter table public.title_seasons enable row level security;

-- csak a saját címek évadai (beíráskor a cím is a felhasználóé legyen)
create policy "title_seasons_own" on public.title_seasons
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.titles t
                 where t.id = title_id and t.user_id = (select auth.uid()))
  );

-- mikor nézte meg utoljára az app a TMDB-n a sorozat évadait (új évad felvételéhez)
alter table public.titles add column seasons_checked_at timestamptz;


-- ---------- Évad: megnézettre állításkor ----------
-- Mint a címeknél: az átváltás pillanatában a "Letöltve" törlődik (később kézzel újra
-- bejelölhető), és beíródik a megnézés napja; ha már nem megnézett, a dátum törlődik.
create or replace function public.title_seasons_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'watched' then
    if tg_op = 'INSERT' or old.status is distinct from 'watched' then
      new.is_downloaded := false;
      new.watched_at := coalesce(new.watched_at, (now() at time zone 'Europe/Budapest')::date);
    end if;
  else
    new.watched_at := null;
  end if;
  return new;
end;
$$;

create trigger title_seasons_before_write
before insert or update on public.title_seasons
for each row execute function public.title_seasons_before_write();


-- ---------- A sorozat az évadokból ----------
-- minden megjelent évad megnézve → Megnézve; van megkezdett / megnézett évad → Folyamatban;
-- különben üres (megnézendő). Letöltve: van letöltött évad. A megnézés napja a legutóbb
-- megnézett évadé.
create or replace function public.sync_title_from_seasons()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tid           bigint;
  today         date := (now() at time zone 'Europe/Budapest')::date;
  total         int;
  aired         int;
  aired_watched int;
  started       int;
  downloaded    boolean;
  last_watched  date;
  next_status   text;
begin
  if tg_op = 'DELETE' then
    tid := old.title_id;
  else
    tid := new.title_id;
  end if;

  select count(*),
         count(*) filter (where s.air_date <= today),
         count(*) filter (where s.air_date <= today and s.status = 'watched'),
         count(*) filter (where s.status in ('watching', 'watched')),
         coalesce(bool_or(s.is_downloaded), false),
         max(s.watched_at)
    into total, aired, aired_watched, started, downloaded, last_watched
    from public.title_seasons s
   where s.title_id = tid;

  -- ha már egy évad sincs (vagy a sorozatot törlik), a cím marad, ahogy van
  if total = 0 then
    return null;
  end if;

  next_status := case
    when aired > 0 and aired_watched = aired then 'watched'
    when started > 0 then 'watching'
    else 'to_watch'
  end;

  update public.titles t
     set status        = next_status,
         is_downloaded = downloaded,
         watched_at    = case when next_status = 'watched'
                              then coalesce(last_watched, today)
                              else null end
   where t.id = tid
     and (t.status is distinct from next_status
          or t.is_downloaded is distinct from downloaded
          or (next_status = 'watched') is distinct from (t.watched_at is not null));
  return null;
end;
$$;

create trigger title_seasons_sync_title
after insert or update or delete on public.title_seasons
for each row execute function public.sync_title_from_seasons();


-- ---------- Nézet újralétrehozása ----------
-- A t.* miatt az új oszlop (seasons_checked_at) csak újralétrehozás után jelenik meg; a
-- seasons oszlop az évadok listája (évadszám szerint), filmnél és évad nélkül üres tömb.
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
