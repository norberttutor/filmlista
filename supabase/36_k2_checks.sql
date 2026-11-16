-- =========================================================
-- Filmlista – 36. lépés: K2 felülvizsgálat (K2.1, jogok szűkítése)
-- A 35_review3_checks.sql UTÁN futtasd
-- =========================================================
-- K2.1: Mama a „Nem érdekel”-t akkor is visszaválthatja „Érdekel”-re, ha a film korábban már „Érdekli” volt (van
--       rá mama_interested értesítés – a harangból törölt sor is megmarad; ha a gazda állította be az „Érdekli”-t, a
--       „Nem érdekel” egy eleve törölt sort ír), akkor is, ha a film azóta lekerült a
--       listájáról (megnézve / franchise-ba került). Az R18 (35) óta a „Visszavonás” ilyenkor elbukott, és a film a
--       „Nem érdekli”-n ragadt – Mama többé nem látta.
-- Jogok: az anon szerep nem írhat egy táblába sem (eddig a Supabase-alap minden jogot megadott – az RLS miatt
--       hatástalanul); a TRUNCATE (az RLS-t megkerüli) senkinek sem kell. Az anon olvasási joga marad: a napi
--       keepalive a statuses táblát olvassa (az RLS miatt üresen).


-- ---------- K2.1: Mama jelölése ----------
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
  v_was_interested boolean;
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
  -- a „Nem érdekel” előtt „Érdekli” volt-e (K2.1: a visszavonás ezt állítja vissza)
  v_was_interested := exists (
    select 1 from public.notifications n
     where n.title_id = t.id and n.kind = 'mama_interested' and n.user_id = v_owner
  );
  -- jelöletlen filmet csak akkor, ha Mama listáján van; a „Nem érdekel”-t „Érdekel”-re is csak akkor (R18) – kivéve,
  -- ha korábban már „Érdekli” volt (K2.1)
  if (t.mama_status is null
      or (t.mama_status = 'declined' and p_choice = 'interested' and not v_was_interested))
     and not v_on_list then
    raise exception 'Ez a film nincs a listádon.';
  end if;

  update public.titles set mama_status = p_choice where titles.id = t.id;

  -- „Érdekli” → „Nem érdekel”: a korábbi „Érdekli” nyoma (K2.1) – ha a gazda állította be (nincs értesítése), egy
  -- eleve törölt (a harangban nem látszó) sor
  if p_choice = 'declined' and t.mama_status = 'interested' then
    insert into public.notifications (user_id, title_id, season_number, kind, read_at, dismissed_at)
    values (v_owner, t.id, 0, 'mama_interested', now(), now())
    on conflict (title_id, season_number, kind) do nothing;
  end if;

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


-- ---------- Jogok szűkítése ----------
revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
-- az ezután létrehozott táblákra is (a sémaszkripteket a postgres szerep futtatja)
alter default privileges for role postgres in schema public
  revoke insert, update, delete, truncate, references, trigger on tables from anon;
alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from authenticated;
