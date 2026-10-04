-- =========================================================
-- Filmlista – 13. lépés: kézzel hozzárendelt TMDB-gyűjtemények a franchise-okhoz
-- A 12_backups.sql UTÁN futtasd
-- =========================================================
-- A franchise-gyűjtemény ablak (components/FranchiseCollection.js) a franchise filmjeiből
-- maga megtalálja a TMDB-gyűjteményeket. Ahol ez nem elég (pl. a franchise-ban csak sorozatok
-- vagy gyűjtemény nélküli filmek vannak – Star Wars, The Walking Dead), Norbi kézzel is
-- hozzárendelhet egyet vagy többet (TMDB collection id-k). Az RLS a franchise-okon már
-- megvan (a felhasználó a sajátját módosíthatja); a heti mentés (12_backups.sql) a tábla
-- sorait változatlanul menti, így ezt az oszlopot is.
-- Szándékosan NULL is lehet (az app üresnek veszi): az oszlop előtti mentésekben nincs ilyen
-- kulcs, a visszaállítás (jsonb_populate_recordset) ott NULL-t ír – NOT NULL mellett elbukna.

alter table public.franchises
  add column tmdb_collection_ids integer[] default '{}';
