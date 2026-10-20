import { getUserFromRequest, supabaseAsUser, unauthorized } from '@/lib/server/auth';
import { tmdbErrorResponse, cachedResponse, HOUR_S } from '@/lib/server/tmdb';
import { TOPLIST_TYPES, TOPLIST_LISTS, loadToplist } from '@/lib/server/toplists';

// az első összeállítás (sok TMDB- és OMDb-kérés) 10–30 másodperc is lehet
export const maxDuration = 60;

// GET /api/tmdb/toplist?type=movie|tv&list=all|recent|gems (terv-3 120)
// A ⋮ „Toplisták” egy listája: { items, complete, built_at }. Az items legfeljebb 250 cím a rangsor
// szerint (a böngésző szűr műfajra / évtizedre, és 100-at mutat). complete: hamis, ha az OMDb napi
// kerete elfogyott – a hiányzó értékelések holnap jönnek. Kész listánál egy óráig a böngészőben tárolva.
export async function GET(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const params = new URL(request.url).searchParams;
  const type = params.get('type');
  const list = params.get('list');
  if (!TOPLIST_TYPES.includes(type) || !TOPLIST_LISTS.includes(list)) {
    return Response.json(
      { error: 'Hibás kérés: a type legyen movie vagy tv, a list all, recent vagy gems.' },
      { status: 400 }
    );
  }
  try {
    const { items, complete, built_at } = await loadToplist(supabaseAsUser(request), type, list);
    const body = { items, complete, built_at };
    return complete ? cachedResponse(body, HOUR_S) : Response.json(body);
  } catch (err) {
    // az adatbázis hibája is ide jut: a TMDB-üzenet („nem érhető el, próbáld újra”) mindkettőre igaz
    return tmdbErrorResponse(err);
  }
}
