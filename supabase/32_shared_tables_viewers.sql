-- =========================================================
-- Filmlista – 32. lépés: a közös táblákat a nézők nem írhatják (átnézés, V6)
-- A 31_critic_ratings.sql UTÁN futtasd
-- =========================================================
-- A közös (nem felhasználóhoz kötött) táblákat eddig bármely belépett fiók írhatta: a műfajneveket
-- (genres – a címfelvétel és a details-refresh bővíti) és a toplisták két gyorsítótárát
-- (store_imdb_ratings, store_toplist). A néző (Mama, list_viewers) semmit nem vesz fel, toplistát sem
-- nyit – innentől egyiket sem írhatja. Olvasni továbbra is mindenki tud.
-- A list_viewers saját sorát a néző látja (RLS), így a policy a felhasználó jogaival is működik.


-- ---------- Műfajok ----------
drop policy "genres_insert" on public.genres;
drop policy "genres_update" on public.genres;

create policy "genres_insert" on public.genres
  for insert to authenticated
  with check (not exists (select 1 from public.list_viewers v where v.viewer_id = (select auth.uid())));

create policy "genres_update" on public.genres
  for update to authenticated
  using (not exists (select 1 from public.list_viewers v where v.viewer_id = (select auth.uid())))
  with check (not exists (select 1 from public.list_viewers v where v.viewer_id = (select auth.uid())));


-- ---------- IMDb-értékelések gyorsítótára ----------
-- (a 29_toplists.sql változata, a nézők kizárásával)
create or replace function public.store_imdb_ratings(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
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
  on conflict (imdb_id) do update
     set rating = excluded.rating, votes = excluded.votes, checked_at = excluded.checked_at;
end;
$$;


-- ---------- Kész toplisták ----------
create or replace function public.store_toplist(p_key text, p_items jsonb, p_complete boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
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
