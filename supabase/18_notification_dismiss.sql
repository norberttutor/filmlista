-- =========================================================
-- Filmlista – 18. lépés: értesítések törlése
-- A 17_mama_access.sql UTÁN futtasd
-- =========================================================
-- A harangban az értesítés törölhető (egyenként ×, vagy „Összes törlése”). A sor nem törlődik,
-- csak elrejtett lesz (dismissed_at): a gyűjtők (collect_release_notifications – 14 napig –, az
-- évadfrissítés) az egyedi kulcs (title_id, season_number, kind) ütközésekor nem írnak újat, így a
-- törölt értesítés nem jön vissza. Mama újbóli „Érdekel” jelölésekor viszont újra megjelenik.
-- NULL-t enged: a régebbi mentések visszaállításakor üres marad (= látható).


-- ---------- Oszlop ----------
alter table public.notifications add column dismissed_at timestamptz;


-- ---------- Mama jelölése: újbóli „Érdekel”-nél a törölt értesítés is visszajön ----------
create or replace function public.mama_mark(p_title_id bigint, p_choice text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  t public.titles;
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
  -- jelöletlen filmet csak akkor, ha Mama listáján van (a „null in (…)” NULL lenne – külön ág)
  if t.mama_status is null
     and not (t.status = 'to_watch' and t.franchise_id is null and public.title_released(t)) then
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
