-- =========================================================
-- Filmlista – 14. lépés: filmek megjelenési dátumai, értesítés a digitális megjelenésről
-- A 13_franchise_collections.sql UTÁN futtasd
-- =========================================================
-- A még meg nem jelent filmek a felületen szaggatott kerettel és dátumos jelvénnyel válnak el
-- („Hamarosan · okt. 15.”, „Moziban · digitálisan: nov. 20.”). A dátumok a TMDB-ről jönnek
-- (release_dates: magyar, ha nincs, amerikai; 3 = mozi, 4 = digitális): az új címek felvételkor,
-- a meglévők a háttérben (/api/tmdb/releases, 3 naponta, a meg nem nézett tavalyi / idei /
-- jövőbeli filmekre). A harang szól, ha egy ilyen film digitálisan megjelent (letölthető lett).
-- Az új oszlopok NULL-t engednek (a régi mentések visszaállíthatók maradnak).

alter table public.titles
  add column if not exists theatrical_release date,       -- mozis bemutató
  add column if not exists digital_release    date,       -- digitális (letölthető) megjelenés
  add column if not exists release_checked_at timestamptz; -- mikor néztük a TMDB-n


-- ---------- Értesítés: a film digitálisan megjelent ----------
-- filmnél a season_number 0 (az egyedi kulcs így is egy értesítést enged címenként)
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('season_announced', 'season_aired', 'movie_digital'));

-- A felhasználó jogaival (RLS) fut, az app betöltéskor hívja (a collect_season_notifications
-- mellett). Csak a friss (14 napon belüli) digitális megjelenésről szól, és csak ha a film akkor
-- még nem volt megjelent, amikor a listára került; megnézett filmről nem. Egy filmről egyszer.
create or replace function public.collect_release_notifications()
returns void
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Budapest')::date;
begin
  insert into public.notifications (user_id, title_id, season_number, kind, air_date)
  select t.user_id, t.id, 0, 'movie_digital', t.digital_release
    from public.titles t
   where t.media_type = 'movie'
     and t.digital_release is not null
     and t.digital_release <= today
     and t.digital_release > today - 14
     and t.digital_release > (t.created_at at time zone 'Europe/Budapest')::date
     and t.status <> 'watched'
  on conflict (title_id, season_number, kind) do nothing;
end;
$$;

revoke execute on function public.collect_release_notifications() from public, anon;
grant execute on function public.collect_release_notifications() to authenticated;


-- ---------- Nézet: a t.* az új oszlopokat csak újralétrehozva adja ----------
drop view public.titles_with_genres;

create view public.titles_with_genres
with (security_invoker = true) as
select
  t.*,
  s.name as status_name,
  coalesce(
    array_agg(g.name order by g.name) filter (where g.id is not null),
    '{}'
  ) as genres,
  coalesce(
    (select jsonb_agg(
              jsonb_build_object(
                'season_number', ts.season_number,
                'name',          ts.name,
                'episode_count', ts.episode_count,
                'air_date',      ts.air_date,
                'status',        ts.status,
                'is_downloaded', ts.is_downloaded,
                'watched_at',    ts.watched_at)
              order by ts.season_number)
       from public.title_seasons ts
      where ts.title_id = t.id),
    '[]'::jsonb
  ) as seasons
from public.titles t
join      public.statuses     s  on s.code = t.status
left join public.title_genres tg on tg.title_id = t.id
left join public.genres       g  on g.id = tg.genre_id
group by t.id, s.name;
