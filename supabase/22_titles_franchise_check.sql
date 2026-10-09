-- Kódaudit #41 (2026-10-09): a titles RLS-szabálya íráskor azt is nézze, hogy a cím franchise-a
-- (franchise_id) a felhasználóé-e. Eddig csak a cím gazdáját ellenőrizte, így – elvben – egy cím
-- más fiók franchise-ára is hivatkozhatott (a megosztott oldal t.user_id = f.user_id-vel védett,
-- a felület soha nem küld ilyet). Az olvasás (using) nem változik.
-- A security definer függvények (restore_my_backup, mama_mark) a tulajdonosuk jogával, RLS nélkül
-- futnak – rájuk nincs hatással; a franchise törlésekor a „set null” sem RLS alatt fut.
-- Futtatás előtt: nincs ilyen sor (0 – 2026-10-09).

drop policy "titles_own" on public.titles;

create policy "titles_own" on public.titles
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      franchise_id is null
      or exists (
        select 1 from public.franchises f
         where f.id = titles.franchise_id
           and f.user_id = (select auth.uid())
      )
    )
  );
