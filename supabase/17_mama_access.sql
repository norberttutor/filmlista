-- =========================================================
-- Filmlista – 17. lépés: Mama külön hozzáférése (terv-3 13, Norbi specifikációja, 2026-10-07)
-- A 16_hidden_suggestions.sql UTÁN futtasd
-- =========================================================
-- Mama saját (jelszavas) fiókkal lép be, és Norbi listájából csak ezt látja: a franchise nélküli,
-- megnézendő, Mama-jelölés nélküli, már megjelent filmeket (a letöltötteket is), valamint az
-- „Érdekli” jelölésűeket, amíg Norbi „Megkapta”-ra nem állítja őket. Jelölhet: „Érdekel”
-- (interested) / „Nem érdekel” (declined, új érték) / visszavonás (null). Az „Érdekel”-ről Norbi
-- értesítést kap (mama_interested). Film felvétele nincs.
-- Mama a titles táblát közvetlenül nem látja (az RLS marad): csak a két security definer
-- függvényen át – mama_list() és mama_mark() –, és csak a megjelenítéshez szükséges oszlopokat.


-- ---------- Ki kinek a listáját nézi ----------
-- Írni csak SQL-ből (adminként) lehet; a néző a saját sorát látja – ebből tudja az app, hogy
-- Mama lépett be. Egy nézőhöz egy gazda tartozik.
create table public.list_viewers (
  viewer_id  uuid primary key references auth.users (id) on delete cascade,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (viewer_id <> owner_id)
);

alter table public.list_viewers enable row level security;

create policy "list_viewers_own_row" on public.list_viewers
  for select to authenticated
  using (viewer_id = (select auth.uid()));


-- ---------- „Nem érdekli” (declined) ----------
-- Csak bővül: a régi mentések visszaállíthatók.
alter table public.titles drop constraint titles_mama_status_check;
alter table public.titles add constraint titles_mama_status_check
  check (mama_status in ('interested', 'declined', 'received'));


-- ---------- Értesítés: „Mamát érdekli” ----------
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('season_announced', 'season_aired', 'movie_digital', 'mama_interested'));


-- ---------- Megjelent-e a film ----------
-- Ugyanaz a szabály, mint a lib/titles.js releaseState()-jében (ha az egyik változik, a másikat is
-- módosítani kell): megjelent, ha a digitális dátum ≤ ma; nem, ha a mozis bemutató a jövőben van
-- vagy csak jövőbeli digitális dátum van; csak mozis dátumnál, ha 120 napnál régebbi; dátum nélkül,
-- ha van év és az ≤ idei. „Ma” budapesti idő szerint.
create or replace function public.title_released(t public.titles)
returns boolean
language sql
stable
set search_path = ''
as $$
  with d as (select (now() at time zone 'Europe/Budapest')::date as today)
  select case
    when t.digital_release is not null and t.digital_release <= d.today then true
    when t.theatrical_release is not null and t.theatrical_release > d.today then false
    when t.digital_release is not null then false
    when t.theatrical_release is not null then d.today - t.theatrical_release > 120
    else t.release_year is not null and t.release_year <= extract(year from d.today)
  end
  from d
$$;

revoke all on function public.title_released(public.titles) from public, anon, authenticated;


-- ---------- Mama listája ----------
-- A hívó (Mama) gazdájának filmjei: a jelöletlenek a fenti feltétellel + az „Érdekli”-k (bármilyen
-- állapotban, a Megkaptáig); a legutóbb hozzáadott elöl. Nem néző hívónak üres.
create or replace function public.mama_list()
returns table (
  id             bigint,
  tmdb_id        integer,
  title          text,
  original_title text,
  release_year   smallint,
  poster_path    text,
  backdrop_path  text,
  overview       text,
  imdb_rating    numeric,
  imdb_votes     integer,
  genres         text[],
  mama_status    text,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.tmdb_id, t.title, t.original_title, t.release_year, t.poster_path,
         t.backdrop_path, t.overview, t.imdb_rating, t.imdb_votes,
         coalesce((select array_agg(g.name order by g.name)
                     from public.title_genres tg
                     join public.genres g on g.id = tg.genre_id
                    where tg.title_id = t.id), '{}'),
         t.mama_status, t.created_at
    from public.list_viewers v
    join public.titles t on t.user_id = v.owner_id
   where v.viewer_id = (select auth.uid())
     and t.media_type = 'movie'
     and (t.mama_status = 'interested'
          or (t.mama_status is null
              and t.status = 'to_watch'
              and t.franchise_id is null
              and public.title_released(t)))
   order by t.created_at desc, t.id desc
$$;

revoke all on function public.mama_list() from public, anon;
grant execute on function public.mama_list() to authenticated;


-- ---------- Mama jelölése ----------
-- p_choice: 'interested' („Érdekel”) / 'declined' („Nem érdekel”) / null (visszavonás). Csak a
-- gazda filmjére, ami Mama listáján van (vagy éppen „Nem érdekli” – a visszavonáshoz, átváltáshoz);
-- „Megkapta” filmre nem. Csak a mama_status-t írja. Ha a film most lett „Érdekli”, Norbi
-- értesítést kap (újbóli jelöléskor újra olvasatlan lesz). Visszaadja az új jelölést.
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
      do update set created_at = now(), read_at = null;
  end if;

  return p_choice;
end;
$$;

revoke all on function public.mama_mark(bigint, text) from public, anon;
grant execute on function public.mama_mark(bigint, text) to authenticated;
