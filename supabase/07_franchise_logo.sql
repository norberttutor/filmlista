-- =========================================================
-- Filmlista – 7. lépés: franchise-logók
-- A 06_watched_clears_downloaded.sql UTÁN futtasd
-- =========================================================

-- logo_path: TMDB képútvonal – a franchise legismertebb (legtöbb IMDb-szavazatú) filmjének
--            címlogója; az app tölti ki (/api/franchises/logos)
-- logo_checked_at: mikor kerestünk utoljára logót, hogy logó nélküli franchise-nál
--                  ne próbálkozzunk minden betöltéskor
alter table public.franchises
  add column logo_path       text,
  add column logo_checked_at timestamptz;
