// TMDB API hívások – csak route handlerből használható,
// mert a TMDB_READ_TOKEN nem kerülhet a böngészőbe.

const TMDB_API = 'https://api.themoviedb.org/3';

class TmdbError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status; // a TMDB HTTP státusza, vagy null, ha nincs token
  }
}

export async function tmdbFetch(path, params = {}) {
  const token = process.env.TMDB_READ_TOKEN;
  if (!token) throw new TmdbError('A TMDB_READ_TOKEN nincs beállítva', null);

  const url = new URL(TMDB_API + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  });
  if (!res.ok) throw new TmdbError(`TMDB ${res.status}: ${await res.text()}`, res.status);
  return res.json();
}

// A hibát a felhasználónak szóló, magyar üzenetű válasszá alakítja.
export function tmdbErrorResponse(err) {
  console.error(err);

  if (err.status === null || err.status === 401) {
    return Response.json(
      {
        error:
          'A szerveren hiányzik vagy hibás a TMDB_READ_TOKEN. Ellenőrizd a .env.local fájlt (Vercelen: Settings → Environment Variables), majd indítsd újra az appot.',
      },
      { status: 500 }
    );
  }
  if (err.status === 404) {
    return Response.json({ error: 'Ez a cím nem található a TMDB-n.' }, { status: 404 });
  }
  return Response.json(
    { error: 'A TMDB most nem érhető el. Próbáld újra pár perc múlva.' },
    { status: 502 }
  );
}

// "2021-09-15" → 2021; üres dátumnál null
export function yearOf(date) {
  return date ? Number(date.slice(0, 4)) : null;
}
