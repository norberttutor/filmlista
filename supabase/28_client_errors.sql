-- =========================================================
-- Filmlista – 28. lépés: hibanapló (terv-3 113)
-- A 27_followed_people.sql UTÁN futtasd
-- =========================================================
-- A böngészőben történt hibák (hibalap, el nem kapott hiba, kezeletlen ígéret-hiba, sikertelen
-- mentés) egy táblába kerülnek, hogy Norbi (és Claude) lássa, mi romlott el – a ⋮ „Hibák (N)”
-- ablakban. Mama hibái a gazdája (Norbi) naplójába kerülnek (owner_id), Mama maga nem látja őket.
--
-- Írni csak a log_client_error() függvény tud: az ismétlődő hiba (ugyanaz a fajta, üzenet és az
-- első veremsor – fingerprint) egy sorba kerül (count, last_at; ha már látott volt, újra olvasatlan).
-- Korlátok: 30 napnál régebben nem ismétlődött sor törlődik, felhasználónként legfeljebb 200 sor,
-- óránként legfeljebb 60 új sor (egy elszabadult hibahurok se töltse tele).
--
-- Nincs a mentésben (a backup_snapshot nem érinti), és nincs a Realtime publikációban.


create table public.client_errors (
  id          bigint      generated always as identity primary key,
  user_id     uuid        not null references auth.users (id) on delete cascade,  -- akinél történt
  owner_id    uuid        not null references auth.users (id) on delete cascade,  -- akinek a naplójában van
  kind        text        not null check (kind in ('error', 'rejection', 'render', 'save')),
  message     text        not null,
  stack       text,
  url         text,
  app_version text,
  user_agent  text,
  fingerprint text        not null,
  count       integer     not null default 1,
  first_at    timestamptz not null default now(),
  last_at     timestamptz not null default now(),
  seen_at     timestamptz,
  unique (user_id, fingerprint)
);

create index client_errors_owner_idx on public.client_errors (owner_id, last_at desc);

alter table public.client_errors enable row level security;

-- a saját napló (a Mamáé is) olvasható, olvasottnak jelölhető és törölhető; beszúrni csak a függvény
create policy "client_errors_owner_select" on public.client_errors
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "client_errors_owner_update" on public.client_errors
  for update to authenticated
  using      (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "client_errors_owner_delete" on public.client_errors
  for delete to authenticated
  using (owner_id = (select auth.uid()));


create or replace function public.log_client_error(
  p_kind text,
  p_message text,
  p_stack text default null,
  p_url text default null,
  p_app_version text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_owner uuid;
  v_message text := left(coalesce(nullif(trim(p_message), ''), '(üzenet nélkül)'), 500);
  v_stack text := left(p_stack, 4000);
  v_fingerprint text;
begin
  if v_user is null then
    return;
  end if;
  if p_kind not in ('error', 'rejection', 'render', 'save') then
    raise exception 'Érvénytelen hibafajta.';
  end if;

  -- Mama (néző) hibája a gazdája naplójába kerül
  select owner_id into v_owner from public.list_viewers where viewer_id = v_user;
  v_owner := coalesce(v_owner, v_user);

  -- a fajta, az üzenet és a verem első sora (a hely) azonosítja; a számok (azonosítók, sor:oszlop)
  -- nélkül, hogy ugyanaz a hiba más címnél is egy sor legyen
  v_fingerprint := md5(
    p_kind || '|' || regexp_replace(v_message, '\d+', '#', 'g') || '|'
    || regexp_replace(coalesce(split_part(v_stack, e'\n', 2), ''), '\d+', '#', 'g')
  );

  update public.client_errors
     set count = count + 1,
         last_at = now(),
         message = v_message,
         stack = coalesce(v_stack, stack),
         url = left(p_url, 500),
         app_version = left(p_app_version, 80),
         user_agent = left(p_user_agent, 300),
         seen_at = null
   where user_id = v_user and fingerprint = v_fingerprint;
  if found then
    return;
  end if;

  -- óránként legfeljebb 60 új sor (felhasználónként)
  if (select count(*) from public.client_errors
       where user_id = v_user and first_at > now() - interval '1 hour') >= 60 then
    return;
  end if;

  insert into public.client_errors
    (user_id, owner_id, kind, message, stack, url, app_version, user_agent, fingerprint)
  values
    (v_user, v_owner, p_kind, v_message, v_stack, left(p_url, 500), left(p_app_version, 80),
     left(p_user_agent, 300), v_fingerprint)
  on conflict (user_id, fingerprint) do update
    set count = public.client_errors.count + 1, last_at = now(), seen_at = null;

  -- takarítás: 30 napnál régebben nem ismétlődött sorok, és a 200 legfrissebb fölöttiek
  delete from public.client_errors
   where owner_id = v_owner and last_at < now() - interval '30 days';
  delete from public.client_errors
   where id in (select id from public.client_errors
                 where owner_id = v_owner
                 order by last_at desc
                 offset 200);
end;
$$;

revoke all on function public.log_client_error(text, text, text, text, text, text) from public, anon;
grant execute on function public.log_client_error(text, text, text, text, text, text) to authenticated;
