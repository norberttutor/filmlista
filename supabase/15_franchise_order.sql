-- =========================================================
-- Filmlista – 15. lépés: nézési sorrend a franchise-okban
-- A 14_release_dates.sql UTÁN futtasd
-- =========================================================
-- A franchise gyűjtemény-ablakában a „Nézési sorrend” fül: a franchise listán lévő filmjei és a
-- sorozatok évadjai (külön tételként) saját sorrendben. Itt csak a sorrend tárolódik – a
-- megnézett állapot a címekből / évadokból jön, így mindig egyezik a listával. Amíg egy
-- franchise-nak nincs tárolt sorrendje, a felület megjelenés szerint mutatja; a tárolt sorrendben
-- nem szereplő (új) tételek a végére kerülnek.
-- A mentés (backups) is tartalmazza: a pillanatkép version 2 lesz; a régi (version 1) mentések
-- visszaállíthatók maradnak – sorrend nélkül.


-- ---------- Tábla ----------
-- season_number: 0 = film vagy évad nélküli sorozat, egyébként a sorozat évadja
create table public.franchise_order (
  franchise_id  bigint  not null references public.franchises (id) on delete cascade,
  title_id      bigint  not null references public.titles (id) on delete cascade,
  season_number integer not null default 0 check (season_number >= 0),
  user_id       uuid    not null default auth.uid()
                references auth.users (id) on delete cascade,
  position      integer not null,
  primary key (franchise_id, title_id, season_number)
);

create index franchise_order_user_idx on public.franchise_order (user_id);
create index franchise_order_title_idx on public.franchise_order (title_id);

alter table public.franchise_order enable row level security;

-- csak a sajátját; beíráskor a cím és a franchise is a felhasználóé legyen
create policy "franchise_order_own" on public.franchise_order
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.titles t
                 where t.id = title_id and t.user_id = (select auth.uid()))
    and exists (select 1 from public.franchises f
                 where f.id = franchise_id and f.user_id = (select auth.uid()))
  );


-- ---------- Sorrend mentése egyben ----------
-- A felhasználó jogaival (RLS) fut: a franchise eddigi sorrendjét a megadottra cseréli, egy
-- tranzakcióban. p_items: [{ "title_id": 12, "season_number": 2 }, …] – a tömb sorrendje a
-- nézési sorrend.
create or replace function public.set_franchise_order(p_franchise_id bigint, p_items jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.franchise_order o where o.franchise_id = p_franchise_id;

  insert into public.franchise_order (franchise_id, title_id, season_number, position)
  select p_franchise_id,
         (x.e ->> 'title_id')::bigint,
         coalesce((x.e ->> 'season_number')::integer, 0),
         x.i::integer
    from jsonb_array_elements(p_items) with ordinality as x(e, i);
end;
$$;

revoke execute on function public.set_franchise_order(bigint, jsonb) from public, anon;
grant execute on function public.set_franchise_order(bigint, jsonb) to authenticated;


-- ---------- Más franchise-ba került cím: kikerül a régi sorrendből ----------
-- (ha később visszakerül, újként a sorrend végére jön)
create or replace function public.franchise_order_title_moved()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.franchise_order o
   where o.title_id = new.id
     and o.franchise_id is distinct from new.franchise_id;
  return null;
end;
$$;

create trigger titles_franchise_order_moved
after update of franchise_id on public.titles
for each row
when (old.franchise_id is distinct from new.franchise_id)
execute function public.franchise_order_title_moved();


-- ---------- Mentés: a pillanatkép a sorrendet is tartalmazza (version 2) ----------
create or replace function public.backup_snapshot(p_user uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'version', 2,
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
       where t.user_id = p_user), '[]'),
    'franchise_order', coalesce((
      select jsonb_agg(to_jsonb(o) order by o.franchise_id, o.position)
        from public.franchise_order o
        join public.titles t on t.id = o.title_id
       where t.user_id = p_user), '[]')
  );
$$;

revoke execute on function public.backup_snapshot(uuid) from public, anon, authenticated;


-- ---------- Visszaállítás: a sorrend is (a régi mentésekben nincs: üres marad) ----------
-- A 12_backups.sql függvénye, változatlanul, a végén a franchise_order visszatöltésével.
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
  -- jelölt cím „letöltve” jelét, az évad dátumát) – lásd a trigger-függvények elejét
  -- (12_backups.sql)
  perform set_config('filmlista.restoring', 'on', true);

  -- az évadok, a műfajkapcsolatok, az értesítések és a nézési sorrend kaszkádban törlődnek
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

  insert into public.franchise_order
  select * from jsonb_populate_recordset(null::public.franchise_order, (
    select coalesce(jsonb_agg(e || jsonb_build_object('user_id', uid)), '[]')
      from jsonb_array_elements(coalesce(snap -> 'franchise_order', '[]')) e));

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

revoke execute on function public.restore_my_backup(bigint) from public, anon;
grant execute on function public.restore_my_backup(bigint) to authenticated;
