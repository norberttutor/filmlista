import { getUserFromRequest, supabaseAsUser, unauthorized } from '@/lib/server/auth';
import { tmdbFetch } from '@/lib/server/tmdb';

const BATCH = 40; // egy kérésben legfeljebb ennyi cím (a szerverfüggvény időkorlátja miatt)
const PARALLEL = 8;

// POST /api/tmdb/backdrops
// A belépett felhasználó azon címeinél, amelyeket még nem néztünk meg (backdrop_checked_at
// üres), lekéri a TMDB-ről a háttérképet (backdrop_path) és elmenti – a felhasználó
// jogosultságaival (RLS). Ha a TMDB-n nincs háttérkép vagy a cím már nincs meg, csak a
// backdrop_checked_at kerül be, így nem kérdezzük újra.
// Válasz: { updated: [{ id, backdrop_path, backdrop_checked_at }], remaining }
export async function POST(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const db = supabaseAsUser(request);
  // esedékes: ugyanaz, mint a lib/refreshDue.js backdropDue()-ja (a böngésző azzal dönti el, hív-e)
  const todo = (query) => query.is('backdrop_checked_at', null);

  const { data: batch, error } = await todo(db.from('titles').select('id, media_type, tmdb_id'))
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
          let backdrop = null;
          try {
            const data = await tmdbFetch(`/${t.media_type}/${t.tmdb_id}`, { language: 'hu-HU' });
            backdrop = data.backdrop_path ?? null;
          } catch (err) {
            if (err.status !== 404) throw err; // a TMDB-n már nincs meg: nincs háttérkép
          }
          const fields = { backdrop_path: backdrop, backdrop_checked_at: new Date().toISOString() };
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
