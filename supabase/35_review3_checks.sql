-- =========================================================
-- Filmlista – 35. lépés: átnézés 3, 3. csomag (R18, R19, minőségi apróság)
-- A 34_franchise_order_check.sql UTÁN futtasd
-- =========================================================
-- R18: Mama a „Nem érdekel”-t csak akkor válthatja „Érdekel”-re, ha a film most is a listáján volna (megnézendő,
--      franchise nélküli, megjelent) – eddig bármikor, a megnézett / franchise-os filmnél is.
-- R19: a közös gyorsítótárakat (store_imdb_ratings, store_toplist) névtelen (anonymous) munkamenet sem írhatja, és a
--      beírt értékek tartománya ellenőrzött (értékelés 0–10, szavazat ≥ 0).
-- Apróság: a collect_season_notifications és a seasons_summary végrehajtási joga is csak a belépetteké (mint a többi
--      függvényé) – a triggerek a belépett felhasználó jogaival futnak, ezért az authenticated megkapja.


-- ---------- R18: Mama jelölése ----------
create or replace function public.mama_mark(p_title_id bigint, p_choice text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  t public.titles;
  v_on_list boolean;
begin
  if p_choice is not null and p_choice not in ('interested', 'declined') then
    raise exception 'Érvénytelen jelölés.';
  end if;

  select owner_id into v_owner from public.list_viewers where viewer_id = (select auth.uid());
  if v_owner is null then
    raise exception 'Ehhez a listához nincs hozzáférésed.';
  end if;

  select * into t from public.titles
   where titles.id = p_title_id and user_id = v_owner and media_type = 'movie'
   for update;
  if not found then
    raise exception 'Ez a film nincs a listán.';
  end if;
  if t.mama_status = 'received' then
    raise exception 'Ezt a filmet már megkaptad.';
  end if;
  -- Mama listáján volna-e most (a mama_list() feltétele a jelöletlen filmekre)
  v_on_list := t.status = 'to_watch' and t.franchise_id is null and public.title_released(t);
  -- jelöletlen filmet csak akkor, ha Mama listáján van; a „Nem érdekel”-t „Érdekel”-re is csak akkor (R18)
  if (t.mama_status is null or (t.mama_status = 'declined' and p_choice = 'interested')) and not v_on_list then
    raise exception 'Ez a film nincs a listádon.';
  end if;

  update public.titles set mama_status = p_choice where titles.id = t.id;

  if p_choice = 'interested' and t.mama_status is distinct from 'interested' then
    insert into public.notifications (user_id, title_id, season_number, kind)
    values (v_owner, t.id, 0, 'mama_interested')
    on conflict (title_id, season_number, kind)
      do update set created_at = now(), read_at = null, dismissed_at = null;
  end if;

  return p_choice;
end;
$$;

revoke all on function public.mama_mark(bigint, text) from public, anon;
grant execute on function public.mama_mark(bigint, text) to authenticated;


-- ---------- R19: közös gyorsítótárak ----------
create or replace function public.store_imdb_ratings(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
     or exists (select 1 from public.list_viewers v where v.viewer_id = (select auth.uid())) then
    return;
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'Érvénytelen értékelés-lista.';
  end if;
  insert into public.imdb_ratings (imdb_id, rating, votes, checked_at)
  select x ->> 'imdb_id',
         round((x ->> 'rating')::numeric, 1),
         (x ->> 'votes')::integer,
         now()
    from jsonb_array_elements(p_items) as x
   where x ->> 'imdb_id' ~ '^tt[0-9]{5,10}$'
     and (x ->> 'rating' is null or (x ->> 'rating')::numeric between 0 and 10)
     and (x ->> 'votes' is null or (x ->> 'votes')::integer >= 0)
  on conflict (imdb_id) do update
     set rating = excluded.rating, votes = excluded.votes, checked_at = excluded.checked_at;
end;
$$;

create or replace function public.store_toplist(p_key text, p_items jsonb, p_complete boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
     or exists (select 1 from public.list_viewers v where v.viewer_id = (select auth.uid())) then
    return;
  end if;
  if p_key !~ '^(movie|tv):(all|recent|gems)$' or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) > 400 or octet_length(p_items::text) > 1000000 then
    raise exception 'Érvénytelen toplista.';
  end if;
  insert into public.toplists (key, items, complete, built_at)
  values (p_key, p_items, coalesce(p_complete, false), now())
  on conflict (key) do update
     set items = excluded.items, complete = excluded.complete, built_at = excluded.built_at;
end;
$$;

revoke all on function public.store_imdb_ratings(jsonb) from public, anon;
revoke all on function public.store_toplist(text, jsonb, boolean) from public, anon;
grant execute on function public.store_imdb_ratings(jsonb) to authenticated;
grant execute on function public.store_toplist(text, jsonb, boolean) to authenticated;


-- ---------- Apróság: végrehajtási jogok ----------
revoke all on function public.collect_season_notifications() from public, anon;
grant execute on function public.collect_season_notifications() to authenticated;
revoke all on function public.seasons_summary(bigint) from public, anon;
grant execute on function public.seasons_summary(bigint) to authenticated;
