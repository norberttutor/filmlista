import { getUserFromRequest, supabaseAsUser, unauthorized } from '@/lib/server/auth';
import { tmdbFetch } from '@/lib/server/tmdb';
import { providerIds } from '@/lib/providers';
import { PROVIDERS_REFRESH_DAYS, PROVIDERS_REFRESH_DONE_DAYS } from '@/lib/refreshDue';

const BATCH = 40; // egy kérésben legfeljebb ennyi cím (a szerverfüggvény időkorlátja miatt)
const PARALLEL = 8;
const DAY_MS = 864e5;

// POST /api/tmdb/watch-providers
// Hol nézhető (terv-3 144, a fő lista „Hol nézhető?” szűrője): a belépett felhasználó esedékes címeinél
// lekéri a TMDB-ről a magyarországi streamingszolgáltatókat (lib/providers.js providerIds) és elmenti – a
// felhasználó jogosultságaival (RLS). Esedékes: ugyanaz, mint a lib/refreshDue.js providersDue()-ja (még nem
// néztük; megnézendő / folyamatban 7, megnézett / abbahagyott 30 napnál régebben). Ha a cím már nincs a
// TMDB-n, üres lista kerül be. TMDB-hibánál az adott cím nem kerül be, és a kör leáll.
// Válasz: { updated: [{ id, watch_providers, providers_checked_at }], remaining }
export async function POST(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const db = supabaseAsUser(request);
  const now = Date.now();
  const before = (days) => new Date(now - days * DAY_MS).toISOString();
  const todo = (query) =>
    query
      .not('tmdb_id', 'is', null)
      .or(
        [
          'providers_checked_at.is.null',
          `and(status.in.(to_watch,watching),providers_checked_at.lt."${before(PROVIDERS_REFRESH_DAYS)}")`,
          `and(status.in.(watched,dropped),providers_checked_at.lt."${before(PROVIDERS_REFRESH_DONE_DAYS)}")`,
        ].join(',')
      );

  const { data: batch, error } = await todo(db.from('titles').select('id, media_type, tmdb_id'))
    .order('providers_checked_at', { ascending: true, nullsFirst: true })
    .order('id')
    .limit(BATCH);
  if (error) {
    console.error(error);
    return Response.json({ error: 'Nem sikerült lekérdezni a címeket.' }, { status: 500 });
  }

  const updated = [];
  let failed = false; // pl. a TMDB nem elérhető: most nem próbálkozunk tovább
  for (let i = 0; i < batch.length && !failed; i += PARALLEL) {
    await Promise.all(
      batch.slice(i, i + PARALLEL).map(async (t) => {
        try {
          let ids = [];
          try {
            const data = await tmdbFetch(`/${t.media_type}/${t.tmdb_id}/watch/providers`);
            ids = providerIds(data.results);
          } catch (err) {
            if (err.status !== 404) throw err; // a TMDB-n már nincs meg: sehol nem nézhető
          }
          const fields = { watch_providers: ids, providers_checked_at: new Date().toISOString() };
          const { error: updateError } = await db.from('titles').update(fields).eq('id', t.id);
          if (updateError) throw updateError;
          updated.push({ id: t.id, ...fields });
        } catch (err) {
          console.error(err);
          failed = true;
        }
      })
    );
  }

  const { count } = await todo(db.from('titles').select('id', { count: 'exact', head: true }));
  return Response.json({ updated, remaining: failed ? 0 : (count ?? 0) });
}
