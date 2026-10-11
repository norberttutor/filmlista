import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, tmdbErrorResponse, cached, cachedResponse, DAY_S } from '@/lib/server/tmdb';

const LIMIT = 8;
const SUGGEST_LIMIT = 10; // ennyi javaslat legfeljebb
const SUGGEST_QUERIES = 6; // ennyi keresőszóval legfeljebb
const PER_QUERY = 4; // keresőszavanként ennyi találat (a hátrébb lévők többnyire csak névrokonok)

const pick = (c) => ({ id: c.id, name: c.name, poster_path: c.poster_path ?? null });

async function searchCollections(query) {
  const data = await tmdbFetch('/search/collection', { query, language: 'hu-HU' });
  return (data.results ?? []).filter((c) => !c.adult).map(pick);
}

// GET /api/tmdb/collection-search?q=csillagok
// TMDB-gyűjtemények keresése (a franchise-hoz kézzel hozzárendeléshez).
// GET /api/tmdb/collection-search?suggest=Dűne|Dune
// Javaslatok gépelés nélkül (terv-3 53): a kliens adja a keresőszavakat (a franchise neve és a filmjei
// eredeti címének eleje, „|”-lal elválasztva); szavanként egy keresés, a találatok uniója a szavak
// sorrendjében. A TMDB-nek nincs „kapcsolódó gyűjtemények” végpontja, ez közelítés. Egy napig tárolva;
// ha egy keresés elbukik, a válasz a többivel jön, tárolás nélkül.
// Válasz: { results: [{ id, name, poster_path }] }
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const params = new URL(request.url).searchParams;
  const suggest = params.get('suggest');
  if (suggest != null) return suggestions(suggest);

  const q = params.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return Response.json({ error: 'Írj be legalább 2 karaktert.' }, { status: 400 });
  }
  try {
    const results = (await searchCollections(q)).slice(0, LIMIT);
    return Response.json({ results });
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}

async function suggestions(raw) {
  const queries = [...new Set(raw.split('|').map((s) => s.trim()).filter((s) => s.length >= 2))].slice(0, SUGGEST_QUERIES);
  if (queries.length === 0) return Response.json({ results: [] });
  const settled = await Promise.allSettled(
    queries.map((q) => cached(`colsearch:${q.toLowerCase()}`, DAY_S * 1000, () => searchCollections(q)))
  );
  const ok = settled.filter((r) => r.status === 'fulfilled');
  if (ok.length === 0) return tmdbErrorResponse(settled[0].reason);
  const seen = new Set();
  const results = [];
  for (const r of ok) {
    for (const c of r.value.slice(0, PER_QUERY)) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      results.push(c);
    }
  }
  const body = { results: results.slice(0, SUGGEST_LIMIT) };
  return ok.length === settled.length ? cachedResponse(body, DAY_S) : Response.json(body);
}
