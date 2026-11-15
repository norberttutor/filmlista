import { checkAuth, supabaseAsUser } from '@/lib/server/auth';
import { tmdbErrorResponse, cachedResponse, HOUR_S } from '@/lib/server/tmdb';
import { TOPLIST_TYPES, TOPLIST_LISTS, loadToplist } from '@/lib/server/toplists';

// az első összeállítás (sok TMDB- és OMDb-kérés) 10–30 másodperc is lehet
export const maxDuration = 60;

// GET /api/tmdb/toplist?type=movie|tv&list=all|recent|gems (terv-3 120)
// A ⋮ „Toplisták” egy listája: { items, complete, built_at }. Az items legfeljebb 250 cím a rangsor
// szerint (a böngésző szűr műfajra / évtizedre, és 100-at mutat). complete: hamis, ha az OMDb napi
// kerete elfogyott – a hiányzó értékelések holnap jönnek. Kész listánál egy óráig a böngészőben tárolva.
export async function GET(request) {
  const auth = await checkAuth(request);
  if (auth.response) return auth.response;

  const params = new URL(request.url).searchParams;
  const type = params.get('type');
  const list = params.get('list');
  if (!TOPLIST_TYPES.includes(type) || !TOPLIST_LISTS.includes(list)) {
    return Response.json(
      { error: 'Hibás kérés: a type legyen movie vagy tv, a list all, recent vagy gems.' },
      { status: 400 }
    );
  }
  const db = supabaseAsUser(request);
  // a néző (Mama, list_viewers) nem nyit toplistát, és a közös gyorsítótárba sem ír – az összeállítása az OMDb napi
  // keretét a tárolás nélkül, beszámítatlanul fogyasztaná (átnézés 3, R19)
  const { data: viewer, error: viewerError } = await db
    .from('list_viewers')
    .select('owner_id')
    .eq('viewer_id', auth.user.id)
    .maybeSingle();
  if (viewerError) console.error(viewerError);
  if (viewer) return Response.json({ error: 'Ebben a fiókban a toplisták nem érhetők el.' }, { status: 403 });
  try {
    const { items, complete, built_at } = await loadToplist(db, type, list);
    const body = { items, complete, built_at };
    return complete ? cachedResponse(body, HOUR_S) : Response.json(body);
  } catch (err) {
    // az adatbázis hibája is ide jut: a TMDB-üzenet („nem érhető el, próbáld újra”) mindkettőre igaz
    return tmdbErrorResponse(err);
  }
}
