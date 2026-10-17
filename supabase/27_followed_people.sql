-- =========================================================
-- Filmlista – 27. lépés: kedvenc színészeim / alkotóim (M4)
-- A 26_details_refresh.sql UTÁN futtasd
-- =========================================================
-- A színész (vagy rendező) lapján a „Követem” gombbal követhető. A ⋮ „Színészek és rendezők”
-- ablaka a követetteket mutatja, a harang szól, ha egy követett személy új (dátummal bejelentett)
-- főszerepét / rendezését felveszi a TMDB.
--
-- followed_people: a követések. A név és a fotó azért tárolódik, hogy az ablak TMDB-lekérés nélkül
-- (net nélkül is) kirajzolható legyen. checked_at: az utolsó háttérellenőrzés (/api/people/refresh).
-- Egy személy színészként és rendezőként külön követhető (role).
-- followed_person_credits: a személy ismert filmjei (ebből derül ki, mi új). Ha egy személynek még
-- nincs ismert filmje, az ellenőrzés „első”: csak megjegyez, nem szól.
--
-- Értesítés: új fajta, 'person_new' – a film nincs a listán, ezért a title_id üres (mint a
-- 'collection_new'-nál); a személy (person_id, person_name, person_profile_path) és a film
-- (part_tmdb_id, part_title, part_poster_path, part_year, air_date) adatai.
--
-- Mentés: a követések bekerülnek (a pillanatkép version 4). Az ismert filmek és a személy-értesítések
-- nem (mint a gyűjtemény-részeknél): visszaállításkor a követések cseréje kaszkádban viszi az ismert
-- filmeket, így a következő ellenőrzés újra „első” lesz, nem szól a régiekről. A régebbi (version 1–3)
-- mentések visszaállításakor a követések nem változnak. Minden új oszlop NULL-t enged.


-- ---------- Követések ----------
create table public.followed_people (
  user_id      uuid        not null default auth.uid()
               references auth.users (id) on delete cascade,
  person_id    integer     not null,  -- TMDB-személy
  role         text        not null check (role in ('actor', 'director')),
  name         text        not null,
  profile_path text,
  created_at   timestamptz not null default now(),
  checked_at   timestamptz,
  primary key (user_id, person_id, role)
);

alter table public.followed_people enable row level security;

create policy "followed_people_own" on public.followed_people
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- ---------- Ismert filmek ----------
create table public.followed_person_credits (
  user_id    uuid        not null default auth.uid(),
  person_id  integer     not null,
  role       text        not null,
  tmdb_id    integer     not null,  -- film TMDB-azonosítója
  created_at timestamptz not null default now(),
  primary key (user_id, person_id, role, tmdb_id),
  foreign key (user_id, person_id, role)
    references public.followed_people (user_id, person_id, role) on delete cascade
);

alter table public.followed_person_credits enable row level security;

create policy "followed_person_credits_own" on public.followed_person_credits
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- ---------- Értesítés: új film egy követett személytől ----------
alter table public.notifications
  add column person_id           integer,
  add column person_name         text,
  add column person_profile_path text;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('season_announced', 'season_aired', 'movie_digital', 'mama_interested', 'collection_new', 'person_new'));

alter table public.notifications drop constraint notifications_target_check;
alter table public.notifications add constraint notifications_target_check
  check (
    (kind = 'collection_new' and title_id is null and franchise_id is not null and part_tmdb_id is not null)
    or (kind = 'person_new' and title_id is null and person_id is not null and part_tmdb_id is not null)
    or (kind not in ('collection_new', 'person_new') and title_id is not null)
  );

-- egy filmről személyenként egyszer szól (a többi fajtánál a person_id üres – nem ütközik)
alter table public.notifications add constraint notifications_person_unique unique (user_id, person_id, part_tmdb_id);


-- ---------- Mentés: a követések is (version 4) ----------
create or replace function public.backup_snapshot(p_user uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'version', 4,
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
       where t.user_id = p_user), '[]'),
    'hidden_suggestions', coalesce((
      select jsonb_agg(to_jsonb(h) order by h.created_at)
        from public.hidden_suggestions h
       where h.user_id = p_user), '[]'),
    'followed_people', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at, p.person_id)
        from public.followed_people p
       where p.user_id = p_user), '[]')
  );
$$;

revoke execute on function public.backup_snapshot(uuid) from public, anon, authenticated;


-- ---------- Visszaállítás: a követések is (ha a mentésben vannak) ----------
-- A 16_hidden_suggestions.sql függvénye, változatlanul, a végén a követésekkel.
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

  -- az elrejtett ajánlások nem a címekhez kötődnek: csak akkor cseréljük, ha a mentésben
  -- vannak (version 3-tól); a régebbi mentés visszaállításakor a mostaniak maradnak
  if snap ? 'hidden_suggestions' then
    delete from public.hidden_suggestions h where h.user_id = uid;
    insert into public.hidden_suggestions
    select * from jsonb_populate_recordset(null::public.hidden_suggestions, (
      select coalesce(jsonb_agg(e || jsonb_build_object('user_id', uid)), '[]')
        from jsonb_array_elements(snap -> 'hidden_suggestions') e));
  end if;

  -- a követések is csak akkor (version 4-től); a törlés kaszkádban viszi az ismert filmeket, így a
  -- következő háttérellenőrzés „első” lesz (nem szól a régi filmekről)
  if snap ? 'followed_people' then
    delete from public.followed_people p where p.user_id = uid;
    insert into public.followed_people
    select * from jsonb_populate_recordset(null::public.followed_people, (
      select coalesce(jsonb_agg(e || jsonb_build_object('user_id', uid)), '[]')
        from jsonb_array_elements(snap -> 'followed_people') e));
  end if;

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
