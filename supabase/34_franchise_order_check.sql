-- Átnézés 3, R13 (2026-11-15): a nézési sorrend mentése csak a franchise-ban most is benne lévő címeket veszi fel.
-- Két gépen: ha az egyiken a címet közben más franchise-ba tették (a trigger kivette a régi sorrendből), a másikon
-- a régi vázlatból mentett sorrend visszatette – a cím két franchise sorrendjében szerepelt.
-- A helyek a kimaradó tételek után is folyamatosak (1, 2, 3 …), a tömb sorrendjében.

create or replace function public.set_franchise_order(p_franchise_id bigint, p_items jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  delete from public.franchise_order o where o.franchise_id = p_franchise_id;

  insert into public.franchise_order (franchise_id, title_id, season_number, position)
  select p_franchise_id,
         x.title_id,
         x.season_number,
         row_number() over (order by x.i)::integer
    from (
      select (e ->> 'title_id')::bigint as title_id,
             coalesce((e ->> 'season_number')::integer, 0) as season_number,
             i
        from jsonb_array_elements(p_items) with ordinality as a(e, i)
    ) x
   where exists (
     select 1 from public.titles t where t.id = x.title_id and t.franchise_id = p_franchise_id
   );
end;
$$;

revoke execute on function public.set_franchise_order(bigint, jsonb) from public, anon;
grant execute on function public.set_franchise_order(bigint, jsonb) to authenticated;
