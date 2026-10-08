-- =========================================================
-- Filmlista – 21. lépés: új rész egy franchise TMDB-gyűjteményében → harang (terv-3 36)
-- A 20_franchise_share.sql UTÁN futtasd
-- =========================================================
-- Hetente (az /api/tmdb/collection-parts, a Watchlist betöltéskor hívja) a franchise-ok
-- TMDB-gyűjteményeinek részeit megnézzük: az első ellenőrzés csak megjegyzi az ismert részeket
-- (nem szól), utána az új rész – ha nincs a listán és nem rejtette el („Nem érdekel”) – értesítés.
-- A rész nincs a listán, ezért az értesítés nem címhez kötődik: title_id üres, helyette a
-- franchise és a rész adatai (a harang ezekből rajzol, kattintva az előnézete nyílik).
--
-- Mentés: a mentés (backup_snapshot) az értesítéseket a címeken át gyűjti, így ezek az
-- értesítések és az ismert részek nincsenek benne. Visszaállításkor a franchise-ok törlése
-- kaszkádban viszi őket, a franchise-ok collections_checked_at-je a mentésből jön (a régebbi
-- mentésben üres) – az ismert részek hiányában a következő ellenőrzés újra „első”, tehát nem szól.
-- Az új oszlopok NULL-t engednek (a régi mentések visszaállíthatók maradnak).


-- ---------- Franchise: mikor néztük meg a gyűjteményeit ----------
alter table public.franchises add column collections_checked_at timestamptz;


-- ---------- Az ismert részek (franchise-onként, gyűjteményenként) ----------
create table public.franchise_collection_parts (
  franchise_id  bigint      not null references public.franchises (id) on delete cascade,
  collection_id integer     not null,  -- TMDB-gyűjtemény
  tmdb_id       integer     not null,  -- a rész (film) TMDB-azonosítója
  user_id       uuid        not null default auth.uid()
                references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (franchise_id, collection_id, tmdb_id)
);

create index franchise_collection_parts_user_idx on public.franchise_collection_parts (user_id);

alter table public.franchise_collection_parts enable row level security;

create policy "franchise_collection_parts_own" on public.franchise_collection_parts
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.franchises f
                 where f.id = franchise_id and f.user_id = (select auth.uid()))
  );


-- ---------- Értesítés: új rész a gyűjteményben ----------
alter table public.notifications alter column title_id drop not null;

alter table public.notifications
  add column franchise_id     bigint references public.franchises (id) on delete cascade,
  add column part_tmdb_id     integer,
  add column part_title       text,
  add column part_poster_path text,
  add column part_year        smallint;

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('season_announced', 'season_aired', 'movie_digital', 'mama_interested', 'collection_new'));

-- a gyűjtemény-értesítés a franchise-hoz és a részhez kötődik, a többi a címhez
alter table public.notifications add constraint notifications_target_check
  check (
    (kind = 'collection_new' and title_id is null and franchise_id is not null and part_tmdb_id is not null)
    or (kind <> 'collection_new' and title_id is not null)
  );

-- egy részről franchise-onként egyszer szól (a többi fajtánál mindkettő üres – nem ütközik)
alter table public.notifications add constraint notifications_part_unique unique (franchise_id, part_tmdb_id);

-- RLS: a cím VAGY a franchise legyen a felhasználóé
drop policy "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (title_id is null or exists (select 1 from public.titles t
                                      where t.id = title_id and t.user_id = (select auth.uid())))
    and (franchise_id is null or exists (select 1 from public.franchises f
                                          where f.id = franchise_id and f.user_id = (select auth.uid())))
  );
