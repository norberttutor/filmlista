import { cached, tmdbFetch, yearOf } from '@/lib/server/tmdb';

const DAY = 24 * 60 * 60 * 1000;

// Egy TMDB-gyűjtemény részei megjelenési sorrendben (a dátum nélküli – bejelentett – a végén),
// egy napig tárolva. A gyűjtemény-ablak (/api/tmdb/collection) és a heti „új rész” ellenőrzés
// (/api/tmdb/collection-parts, terv-3 36) is ezt használja. Csak route handlerben.
export const loadCollection = (id) =>
  cached(`collection:${id}`, DAY, async () => {
    const c = await tmdbFetch(`/collection/${id}`, { language: 'hu-HU' });
    return {
      id: c.id,
      name: c.name,
      backdrop_path: c.backdrop_path ?? null,
      parts: (c.parts ?? [])
        .filter((p) => !p.adult)
        .sort((a, b) => (a.release_date || '9999').localeCompare(b.release_date || '9999'))
        .map((p) => ({
          media_type: 'movie',
          tmdb_id: p.id,
          title: p.title,
          original_title: p.original_title,
          release_year: yearOf(p.release_date),
          release_date: p.release_date || null,
          poster_path: p.poster_path ?? null,
        })),
    };
  });
