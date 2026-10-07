import { getUserFromRequest, supabaseAsUser, unauthorized } from '@/lib/server/auth';
import { tmdbFetch } from '@/lib/server/tmdb';
import { budapestToday, collectionDue } from '@/lib/refreshDue';
import { fetchAll } from '@/lib/fetchAll';

const BATCH = 40; // egy kérésben legfeljebb ennyi film (a szerverfüggvény időkorlátja miatt)
const PARALLEL = 8;
// melyik filmet kell (újra) megnézni: lib/refreshDue.js collectionDue() (a böngésző is azzal dönti
// el, hív-e egyáltalán)

// POST /api/tmdb/title-collections
// A belépett felhasználó filmjeinél elmenti, melyik TMDB-gyűjteménybe tartoznak
// (tmdb_collection_id) – a franchise-javaslathoz (terv-3 35). A felhasználó jogaival (RLS); a
// Watchlist betöltéskor hívja, adagonként. Ha a film már nincs a TMDB-n, csak megjelöli.
// Válasz: { updated: [{ id, tmdb_collection_id, collection_checked_at }], remaining }
export async function POST(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const db = supabaseAsUser(request);
  // az összes film (ezres adagokban: egy kérés legfeljebb 1000 sort ad – lib/fetchAll.js)
  const { data: movies, error } = await fetchAll(() =>
    db
      .from('titles')
      .select('id, media_type, tmdb_id, release_year, tmdb_collection_id, collection_checked_at')
      .eq('media_type', 'movie')
      .order('id')
  );
  if (error) {
    console.error(error);
    return Response.json({ error: 'Nem sikerült lekérdezni a filmeket.' }, { status: 500 });
  }
  const today = budapestToday();
  const todo = movies.filter((t) => collectionDue(t, today));
  const batch = todo.slice(0, BATCH);

  const updated = [];
  let failed = false; // pl. a TMDB nem elérhető: most nem próbálkozunk tovább
  for (let i = 0; i < batch.length && !failed; i += PARALLEL) {
    await Promise.all(
      batch.slice(i, i + PARALLEL).map(async (t) => {
        try {
          let collection = null;
          try {
            const data = await tmdbFetch(`/movie/${t.tmdb_id}`, { language: 'hu-HU' });
            collection = data.belongs_to_collection?.id ?? null;
          } catch (err) {
            if (err.status !== 404) throw err; // a TMDB-n már nincs meg: nincs gyűjtemény
          }
          const fields = { tmdb_collection_id: collection, collection_checked_at: new Date().toISOString() };
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

  return Response.json({ updated, remaining: failed ? 0 : todo.length - batch.length });
}
