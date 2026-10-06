-- =========================================================
-- Filmlista – 16. lépés: „Nem érdekel” – elrejtett ajánlások
-- A 15_franchise_order.sql UTÁN futtasd
-- =========================================================
-- A Felfedezés és a Hasonló címek borítóin a × („Nem érdekel”) elrejti a címet: többé nem
-- ajánlja (a keresésben továbbra is megtalálható). A Felfedezés alján „Elrejtett ajánlások” –
-- onnan visszahozható. A cím, a borító és az év azért tárolódik, hogy a lista TMDB-lekérés nélkül
-- megjeleníthető legyen (NULL-t engednek).
-- A mentés (backups) is tartalmazza: a pillanatkép version 3 lesz. A régebbi (version 1–2)
-- mentések visszaállításakor az elrejtett ajánlások nem változnak (azokban nincs ilyen adat).


-- ---------- Tábla ----------
create table public.hidden_suggestions (
  user_id      uuid    not null default auth.uid()
               references auth.users (id) on delete cascade,
  media_type   text    not null check (media_type in ('movie', 'tv')),
  tmdb_id      integer not null,
  title        text,
  poster_path  text,
  release_year integer,
  created_at   timestamptz not null default now(),
  primary key (user_id, media_type, tmdb_id)
);

alter table public.hidden_suggestions enable row level security;

-- csak a sajátját
create policy "hidden_suggestions_own" on public.hidden_suggestions
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));


-- ---------- Mentés: a pillanatkép az elrejtett ajánlásokat is tartalmazza (version 3) ----------
create or replace function public.backup_snapshot(p_user uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'version', 3,
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
       where h.user_id = p_user), '[]')
  );
$$;

revoke execute on function public.backup_snapshot(uuid) from public, anon, authenticated;


-- ---------- Visszaállítás: az elrejtett ajánlások is (ha a mentésben vannak) ----------
-- A 15_franchise_order.sql függvénye, változatlanul, a végén az elrejtett ajánlásokkal.
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
