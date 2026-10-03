-- =========================================================
-- Filmlista – 9. lépés: "Abbahagyva" állapot (sorozat, amit nem néz tovább)
-- A 08_title_seasons.sql UTÁN futtasd
-- =========================================================
-- Sorozatnál jelölhető, hogy nem nézi tovább (akkor sem, ha van / lesz még évad), de a
-- listán marad. Évados sorozatnál az állapot egyébként az évadokból számolódik; az
-- "Abbahagyva" ez alól kivétel: kézzel állítható, és megmarad, amíg vissza nem vonják –
-- az évadok jelölése és az új (TMDB-ről érkező) évad sem írja felül.


-- ---------- Új állapot ----------
insert into public.statuses (code, name, sort_order) values ('dropped', 'Abbahagyva', 4);


-- ---------- A sorozat állapota az évadokból (közös számítás) ----------
-- total = 0: nincs évad (a cím kézi marad). Egyébként: minden megjelent évad megnézve →
-- watched; van megkezdett / megnézett évad → watching; különben to_watch. downloaded: van
-- letöltött évad; last_watched: a legutóbb megnézett évad napja.
create or replace function public.seasons_summary(
  p_title_id       bigint,
  out total        int,
  out next_status  text,
  out downloaded   boolean,
  out last_watched date
)
language plpgsql
stable
set search_path = ''
as $$
declare
  today         date := (now() at time zone 'Europe/Budapest')::date;
  aired         int;
  aired_watched int;
  started       int;
begin
  select count(*),
         count(*) filter (where s.air_date <= today),
         count(*) filter (where s.air_date <= today and s.status = 'watched'),
         count(*) filter (where s.status in ('watching', 'watched')),
         coalesce(bool_or(s.is_downloaded), false),
         max(s.watched_at)
    into total, aired, aired_watched, started, downloaded, last_watched
    from public.title_seasons s
   where s.title_id = p_title_id;

  next_status := case
    when aired > 0 and aired_watched = aired then 'watched'
    when started > 0 then 'watching'
    else 'to_watch'
  end;
end;
$$;


-- ---------- A sorozat az évadokból (a 08-as trigger, most már az "Abbahagyva"-val) ----------
-- Ugyanaz, mint eddig, csak az "Abbahagyva" kézi állapotot nem írja felül: ilyenkor csak a
-- "Letöltve" követi az évadokat, a megnézés napja üres.
create or replace function public.sync_title_from_seasons()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tid         bigint;
  today       date := (now() at time zone 'Europe/Budapest')::date;
  sm          record;
  cur_status  text;
  next_status text;
begin
  if tg_op = 'DELETE' then
    tid := old.title_id;
  else
    tid := new.title_id;
  end if;

  select * into sm from public.seasons_summary(tid);

  -- ha már egy évad sincs (vagy a sorozatot törlik), a cím marad, ahogy van
  if sm.total = 0 then
    return null;
  end if;

  select t.status into cur_status from public.titles t where t.id = tid;
  next_status := case when cur_status = 'dropped' then 'dropped' else sm.next_status end;

  update public.titles t
     set status        = next_status,
         is_downloaded = sm.downloaded,
         watched_at    = case when next_status = 'watched'
                              then coalesce(sm.last_watched, today)
                              else null end
   where t.id = tid
     and (t.status is distinct from next_status
          or t.is_downloaded is distinct from sm.downloaded
          or (next_status = 'watched') is distinct from (t.watched_at is not null));
  return null;
end;
$$;


-- ---------- Évados sorozat állapotának közvetlen írása ----------
-- Ha egy évados sorozat állapotát közvetlenül írják (pl. "Mégis folytatom": az Abbahagyva
-- visszavonása), az "Abbahagyva" kivételével mindig az évadokból számolt állapot kerül be,
-- a "Letöltve" és a megnézés napja is. Az "Abbahagyva" mellett a megnézés napja üres.
-- Évadok nélküli címnél (filmek is) a beírt érték marad.
-- A név miatt a cím többi BEFORE triggere után fut (név szerinti sorrend), így övé az utolsó szó.
create or replace function public.titles_status_from_seasons()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  sm record;
begin
  if new.status = 'dropped' then
    new.watched_at := null;
    return new;
  end if;

  select * into sm from public.seasons_summary(new.id);
  if sm.total > 0 then
    new.status        := sm.next_status;
    new.is_downloaded := sm.downloaded;
    new.watched_at    := case when sm.next_status = 'watched'
                              then coalesce(sm.last_watched,
                                            (now() at time zone 'Europe/Budapest')::date)
                              end;
  end if;
  return new;
end;
$$;

create trigger titles_status_from_seasons
before update of status on public.titles
for each row execute function public.titles_status_from_seasons();
