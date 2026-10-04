-- =========================================================
-- Filmlista – 12. lépés: automatikus heti mentés és visszaállítás
-- A 11_backdrop.sql UTÁN futtasd
-- =========================================================
-- Hetente (hétfőn 03:00 UTC) az adatbázis maga ment minden felhasználó listájáról egy
-- pillanatképet (jsonb) a backups táblába (pg_cron); ilyenkor a 8 hétnél régebbi mentések
-- törlődnek. A felület („Mentések” a ⋮ menüben) listázza őket, kézzel is lehet menteni, és
-- vissza lehet állítani egyet – előtte a mostani állapotról is mentés készül, így a
-- visszaállítás is visszacsinálható.
-- Külső másolat: a GitHub heti feladata (.github/workflows/mentes.yml) a backup_reader
-- szereppel kiolvassa a legfrissebb mentést, és 8 hétre artifactként eltárolja.


-- ---------- Mentések ----------
create table public.backups (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid()
              references auth.users (id) on delete cascade,
  kind        text not null
              check (kind in ('weekly', 'manual', 'before_restore', 'imported')),
  created_at  timestamptz not null default now(),
  title_count integer not null,
  -- { version, franchises, titles, title_genres, genres, title_seasons, notifications }:
  -- a táblák sorai változatlanul (to_jsonb)
  data        jsonb not null
);

create index backups_user_idx on public.backups (user_id, created_at desc);

alter table public.backups enable row level security;

-- a felhasználó a sajátjait látja és törölheti; írni csak a lenti függvények írnak
create policy "backups_select_own" on public.backups
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "backups_delete_own" on public.backups
  for delete to authenticated
  using (user_id = (select auth.uid()));


-- ---------- Pillanatkép egy felhasználó listájáról ----------
-- A hívó jogaival fut: a felhasználó nevében az RLS miatt csak a saját sorai kerülnének bele.
-- A lenti (security definer) függvények hívják.
create or replace function public.backup_snapshot(p_user uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'version', 1,
    'franchises', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.id)
        from public.franchises f
       where f.user_id = p_user), '[]'),
    'titles', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.id)
        from public.titles t
       where t.user_id = p_user), '[]'),
    'title_genres', coalesce((
      select jsonb_agg(to_jsonb(tg) order by tg.title_id, tg.genre_id)
        from public.title_genres tg
        join public.titles t on t.id = tg.title_id
       where t.user_id = p_user), '[]'),
    'genres', coalesce((
      select jsonb_agg(to_jsonb(g) order by g.id)
        from public.genres g
       where g.id in (select tg.genre_id
                        from public.title_genres tg
                        join public.titles t on t.id = tg.title_id
                       where t.user_id = p_user)), '[]'),
    'title_seasons', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.title_id, s.season_number)
        from public.title_seasons s
        join public.titles t on t.id = s.title_id
       where t.user_id = p_user), '[]'),
    'notifications', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.id)
        from public.notifications n
        join public.titles t on t.id = n.title_id
       where t.user_id = p_user), '[]')
  );
$$;


-- ---------- Mentés írása + a 8 hétnél régebbiek törlése ----------
-- Üres listáról nem ment (és ilyenkor a régieket sem törli: ha a lista kiürült, a korábbi
-- mentések megmaradnak). Visszaadja az új mentés azonosítóját (vagy null-t).
create or replace function public.write_backup(p_user uuid, p_kind text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  snap   jsonb := public.backup_snapshot(p_user);
  n      integer := jsonb_array_length(snap -> 'titles');
  new_id bigint;
begin
  if n = 0 then
    return null;
  end if;

  insert into public.backups (user_id, kind, title_count, data)
  values (p_user, p_kind, n, snap)
  returning id into new_id;

  -- 1 óra ráhagyás: a heti futás így pontosan az utolsó 8 heti mentést tartja meg
  delete from public.backups b
   where b.user_id = p_user
     and b.created_at < now() - (interval '8 weeks' - interval '1 hour');

  return new_id;
end;
$$;


-- ---------- Heti mentés mindenkiről (pg_cron hívja) ----------
create or replace function public.backup_all_users()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid;
  n integer := 0;
begin
  for u in select distinct t.user_id from public.titles t loop
    if public.write_backup(u, 'weekly') is not null then
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;


-- ---------- A felületről: mentés most ----------
create or replace function public.create_my_backup()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Nincs bejelentkezve.' using errcode = '42501';
  end if;
  return public.write_backup(auth.uid(), 'manual');
end;
$$;


-- ---------- A felületről: visszaállítás ----------
-- A saját listát a mentés állapotára cseréli (franchise-ok, címek, műfajok, évadok,
-- értesítések – az eredeti azonosítókkal). Előtte a mostaniról mentés készül.
-- Visszaadja a visszaállított címek számát.
create or replace function public.restore_my_backup(p_backup_id bigint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid  uuid := auth.uid();
  snap jsonb;
  tbl  text;
  seq  regclass;
  m    bigint;
begin
  if uid is null then
    raise exception 'Nincs bejelentkezve.' using errcode = '42501';
  end if;

  select b.data into snap
    from public.backups b
   where b.id = p_backup_id and b.user_id = uid;
  if snap is null then
    raise exception 'Nincs ilyen mentés.' using errcode = 'P0002';
  end if;

  perform public.write_backup(uid, 'before_restore');

  -- a triggerek ne írják át a visszatöltött sorokat (pl. a megnézett, de újra letöltöttnek
  -- jelölt cím „letöltve” jelét, az évad dátumát) – lásd a trigger-függvények elejét lent
  perform set_config('filmlista.restoring', 'on', true);

  -- az évadok, a műfajkapcsolatok és az értesítések kaszkádban törlődnek
  delete from public.titles t where t.user_id = uid;
  delete from public.franchises f where f.user_id = uid;

  insert into public.franchises overriding system value
  select * from jsonb_populate_recordset(null::public.franchises, (
    select coalesce(jsonb_agg(e || jsonb_build_object('user_id', uid)), '[]')
      from jsonb_array_elements(snap -> 'franchises') e));

  insert into public.titles overriding system value
  select * from jsonb_populate_recordset(null::public.titles, (
    select coalesce(jsonb_agg(e || jsonb_build_object('user_id', uid)), '[]')
      from jsonb_array_elements(snap -> 'titles') e));

  insert into public.genres
  select * from jsonb_populate_recordset(null::public.genres, snap -> 'genres')
  on conflict (id) do nothing;

  insert into public.title_genres
  select * from jsonb_populate_recordset(null::public.title_genres, snap -> 'title_genres');

  insert into public.title_seasons
  select * from jsonb_populate_recordset(null::public.title_seasons, (
    select coalesce(jsonb_agg(e || jsonb_build_object('user_id', uid)), '[]')
      from jsonb_array_elements(snap -> 'title_seasons') e));

  insert into public.notifications overriding system value
  select * from jsonb_populate_recordset(null::public.notifications, (
    select coalesce(jsonb_agg(e || jsonb_build_object('user_id', uid)), '[]')
      from jsonb_array_elements(snap -> 'notifications') e));

  -- másik adatbázisba visszatöltve (GitHub-mentésből) a számlálók ne adjanak ki foglalt
  -- azonosítót
  foreach tbl in array array['public.franchises', 'public.titles', 'public.notifications'] loop
    seq := pg_get_serial_sequence(tbl, 'id')::regclass;
    execute format('select max(id) from %s', tbl) into m;
    if m > coalesce(pg_sequence_last_value(seq), 0) then
      perform setval(seq, m);
    end if;
  end loop;

  perform set_config('filmlista.restoring', 'off', true);
  return jsonb_array_length(snap -> 'titles');
end;
$$;


-- ---------- Jogosultságok ----------
-- a belső függvényeket csak az adatbázis (és a fenti függvények) hívhatják
revoke execute on function public.backup_snapshot(uuid) from public, anon, authenticated;
revoke execute on function public.write_backup(uuid, text) from public, anon, authenticated;
revoke execute on function public.backup_all_users() from public, anon, authenticated;
revoke execute on function public.create_my_backup() from public, anon;
revoke execute on function public.restore_my_backup(bigint) from public, anon;
grant execute on function public.create_my_backup() to authenticated;
grant execute on function public.restore_my_backup(bigint) to authenticated;


-- ---------- Visszaállítás alatt a triggerek nem módosítanak ----------
-- (a 06_watched_clears_downloaded.sql és a 09_dropped.sql függvényei, változatlanul, csak
-- az elején a visszaállítás jelzőjének vizsgálatával)
create or replace function public.clear_downloaded_when_watched()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('filmlista.restoring', true) = 'on' then
    return new;
  end if;
  if new.status = 'watched'
     and (tg_op = 'INSERT' or old.status is distinct from 'watched') then
    new.is_downloaded := false;
  end if;
  return new;
end;
$$;

create or replace function public.title_seasons_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('filmlista.restoring', true) = 'on' then
    return new;
  end if;
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

create or replace function public.sync_title_from_seasons()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tid         bigint;
  today       date := (now() at time zone 'Europe/Budapest')::date;
  sm          record;
  cur_status  text;
  next_status text;
begin
  if current_setting('filmlista.restoring', true) = 'on' then
    return null;
  end if;

  if tg_op = 'DELETE' then
    tid := old.title_id;
  else
    tid := new.title_id;
  end if;

  select * into sm from public.seasons_summary(tid);

  -- ha már egy évad sincs (vagy a sorozatot törlik), a cím marad, ahogy van
  if sm.total = 0 then
    return null;
  end if;

  select t.status into cur_status from public.titles t where t.id = tid;
  next_status := case when cur_status = 'dropped' then 'dropped' else sm.next_status end;

  update public.titles t
     set status        = next_status,
         is_downloaded = sm.downloaded,
         watched_at    = case when next_status = 'watched'
                              then coalesce(sm.last_watched, today)
                              else null end
   where t.id = tid
     and (t.status is distinct from next_status
          or t.is_downloaded is distinct from sm.downloaded
          or (next_status = 'watched') is distinct from (t.watched_at is not null));
  return null;
end;
$$;


-- ---------- Ütemezés: hétfőnként 03:00 UTC (magyar idő szerint 4 / 5 óra) ----------
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- azonos névvel újra futtatva csak frissíti az ütemezést
select cron.schedule('filmlista-heti-mentes', '0 3 * * 1', 'select public.backup_all_users()');


-- ---------- Csak olvasó szerep a GitHub heti feladatához ----------
-- Csak a backups táblát olvashatja. A jelszavát nem ez a fájl adja (a gitbe nem kerülhet):
-- Claude külön állítja be, és a .env.local BACKUP_DB_URL-jébe írja; onnan kerül a GitHub
-- titkai közé.
create role backup_reader login noinherit;
alter role backup_reader set default_transaction_read_only = on;
alter role backup_reader set statement_timeout = '60s';
grant usage on schema public to backup_reader;
grant select on public.backups to backup_reader;

create policy "backups_reader" on public.backups
  for select to backup_reader
  using (true);
