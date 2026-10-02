-- =========================================================
-- Filmlista – 6. lépés: "Megnézve" állapotnál a "Letöltve" jelző törlődik
-- Az 05_imdb_rating.sql UTÁN futtasd
-- =========================================================


-- ---------- Szabály (trigger) ----------
-- Csak az átváltás pillanatában (vagy megnézettként felvett új címnél) törli a jelzőt;
-- ha később egy megnézett címet kézzel újra letöltöttnek jelölnek, azt nem írja felül.
create or replace function public.clear_downloaded_when_watched()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'watched'
     and (tg_op = 'INSERT' or old.status is distinct from 'watched') then
    new.is_downloaded := false;
  end if;
  return new;
end;
$$;

create trigger titles_clear_downloaded_when_watched
before insert or update of status on public.titles
for each row execute function public.clear_downloaded_when_watched();


-- ---------- Meglévő adatok ----------
update public.titles
   set is_downloaded = false
 where status = 'watched'
   and is_downloaded;
