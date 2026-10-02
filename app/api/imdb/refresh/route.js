import { getUserFromRequest, supabaseAsUser, unauthorized } from '@/lib/server/auth';
import { omdbEnabled, fetchImdbRating } from '@/lib/server/omdb';

const REFRESH_DAYS = 14; // ennél régebbi értékelést újra lekérünk
const BATCH = 25; // egy kérésben legfeljebb ennyi cím (a szerverfüggvény időkorlátja miatt)
const PARALLEL = 5;

// POST /api/imdb/refresh
// A belépett felhasználó címei közül azoknál, ahol hiányzik vagy 14 napnál régebbi az
// IMDb-értékelés, lekéri az OMDb-ből és elmenti (a felhasználó jogosultságaival, RLS-sel).
// Válasz: { updated: [{ id, imdb_rating, imdb_votes, imdb_rating_updated_at }], remaining }
export async function POST(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();
  if (!omdbEnabled()) return Response.json({ updated: [], remaining: 0, disabled: true });

  const db = supabaseAsUser(request);
  const cutoff = new Date(Date.now() - REFRESH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const due = (query) =>
    query
      .not('imdb_id', 'is', null)
      .or(`imdb_rating_updated_at.is.null,imdb_rating_updated_at.lt."${cutoff}"`);

  const { data: batch, error } = await due(db.from('titles').select('id, imdb_id'))
    .order('imdb_rating_updated_at', { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) {
    console.error(error);
    return Response.json({ error: 'Nem sikerült lekérdezni a címeket.' }, { status: 500 });
  }

  const updated = [];
  let failed = false; // pl. elfogyott a napi OMDb-keret: ma már nem próbálkozunk tovább
  for (let i = 0; i < batch.length && !failed; i += PARALLEL) {
    await Promise.all(
      batch.slice(i, i + PARALLEL).map(async (t) => {
        try {
          const fields = {
            ...(await fetchImdbRating(t.imdb_id)),
            imdb_rating_updated_at: new Date().toISOString(),
          };
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

  const { count } = await due(db.from('titles').select('id', { count: 'exact', head: true }));
  return Response.json({ updated, remaining: failed ? 0 : (count ?? 0) });
}
