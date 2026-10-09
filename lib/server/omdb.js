// IMDb-értékelés az OMDb API-ból – csak route handlerből használható,
// mert az OMDB_API_KEY nem kerülhet a böngészőbe. Ingyenes keret: napi 1000 lekérdezés.
import 'server-only'; // kliens-komponensből importálva a build hibát ad (kódaudit #45)

const OMDB_API = 'https://www.omdbapi.com/';
const FETCH_TIMEOUT_MS = 10_000; // egy beragadt kérés ne tartsa fel a route-ot (kódaudit #43)

export function omdbEnabled() {
  return Boolean(process.env.OMDB_API_KEY);
}

// { imdb_rating, imdb_votes } – mindkettő lehet null (pl. még meg nem jelent film).
// Kulcs- vagy kerethibánál (pl. "Request limit reached!") hibát dob.
export async function fetchImdbRating(imdbId) {
  const url = new URL(OMDB_API);
  url.searchParams.set('i', imdbId);
  url.searchParams.set('apikey', process.env.OMDB_API_KEY);

  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const data = await res.json().catch(() => null);
  if (data?.Response !== 'True') {
    if (/not found/i.test(data?.Error ?? '')) return { imdb_rating: null, imdb_votes: null };
    throw new Error(`OMDb ${res.status}: ${data?.Error ?? 'ismeretlen hiba'}`);
  }

  // az OMDb szövegként adja: "8.0", "1,234,567", vagy "N/A"
  const rating = Number(data.imdbRating);
  const votes = Number(String(data.imdbVotes).replaceAll(',', ''));
  return {
    imdb_rating: Number.isFinite(rating) ? rating : null,
    imdb_votes: Number.isFinite(votes) ? votes : null,
  };
}
