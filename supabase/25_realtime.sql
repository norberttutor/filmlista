-- Élő szinkron a gépek között (terv-3 86, 2026-10-14): a Supabase Realtime (postgres_changes) a
-- supabase_realtime publikáció tábláiról küld értesítést a feliratkozott böngészőknek. Az RLS érvényes:
-- a beszúrásról / módosításról mindenki csak a saját sorairól kap üzenetet (a lista a sort úgyis a
-- titles_with_genres nézetből tölti újra). A törlésről (replica identity default) csak a kulcs megy ki
-- (a Realtime a törölt sor jogosultságát nem tudja ellenőrizni) – a felület ebből veszi le a sort.
alter publication supabase_realtime add table
  public.titles,
  public.title_seasons,
  public.notifications,
  public.franchises;
