import { getUserFromRequest, unauthorized } from '@/lib/server/auth';
import { tmdbErrorResponse, cachedResponse, DAY_S } from '@/lib/server/tmdb';
import { loadPerson, ROLES } from '@/lib/server/people';

// GET /api/tmdb/person?id=1190668[&role=director]
// Egy személy lapja az adatlapon belül (terv-3 61) és a követett személy idővonala (M4): adatai és a
// szerepei (filmek és sorozatai; role=director: a rendezett filmjei), címenként egyszer, a
// szerepnevekkel. lead: főszerep (filmben a stáblista első 3 helye, sorozatban legalább 6 rész;
// rendezőnél mind). A „minor” jelű szerepet (borító nélkül, animáció / dokumentum / talkshow…,
// vendégszereplés, önmaga) a kliens csak akkor mutatja, ha a cím a listán van. Az életrajz magyarul,
// ha nincs, angolul (bio_lang). Egy napig gyorsítótárazva; ha a személy nincs a TMDB-n:
// { person: null, credits: [] }.
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const params = new URL(request.url).searchParams;
  const id = Number(params.get('id'));
  const role = params.get('role') ?? 'actor';
  if (!Number.isInteger(id) || id <= 0 || !ROLES.includes(role)) {
    return Response.json(
      { error: 'Hibás kérés: az id pozitív egész szám, a role actor vagy director legyen.' },
      { status: 400 }
    );
  }

  try {
    const { credits, partial, ...rest } = await loadPerson(id, role);
    const body = { ...rest, credits: credits.map(({ minor_genre, ...c }) => c) };
    // a részben hiányos (életrajz nélküli) válasz a böngészőben sem tárolható (átnézés H11)
    return partial ? Response.json(body) : cachedResponse(body, DAY_S);
  } catch (err) {
    return tmdbErrorResponse(err);
  }
}
