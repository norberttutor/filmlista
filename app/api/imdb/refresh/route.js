import { checkAuth, supabaseAsUser } from '@/lib/server/auth';
import { omdbEnabled, fetchImdbRating } from '@/lib/server/omdb';
import { IMDB_REFRESH_DAYS } from '@/lib/refreshDue';
const BATCH = 25; // egy kérésben legfeljebb ennyi cím (a szerverfüggvény időkorlátja miatt)
const PARALLEL = 5;
// az app saját frissítésének kerete az utolsó 24 órában (átnézés 3, R20): az OMDb ingyen napi 1000-et ad, a toplisták
// 400-at vihetnek (lib/server/toplists.js DAILY_OMDB) – torlódáskor (pl. sok új cím) ez se vigye el a teljes keretet
const DAILY_OMDB = 500;

// POST /api/imdb/refresh
// A belépett felhasználó címei közül azoknál, ahol hiányzik vagy 14 napnál régebbi az
// IMDb-értékelés, lekéri az OMDb-ből és elmenti (a felhasználó jogosultságaival, RLS-sel) – ugyanabból a
// válaszból a Rotten Tomatoes és a Metacritic számát is (terv-3 127).
// Válasz: { updated: [{ id, imdb_rating, imdb_votes, rt_rating, mc_rating, imdb_rating_updated_at }], remaining }
export async function POST(request) {
  const auth = await checkAuth(request);
  if (auth.response) return auth.response;
  if (!omdbEnabled()) return Response.json({ updated: [], remaining: 0, disabled: true });

  const db = supabaseAsUser(request);
  // esedékes: ugyanaz, mint a lib/refreshDue.js imdbDue()-ja (a böngésző azzal dönti el, hív-e)
  const cutoff = new Date(Date.now() - IMDB_REFRESH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const due = (query) =>
    query
      .not('imdb_id', 'is', null)
      .or(`imdb_rating_updated_at.is.null,imdb_rating_updated_at.lt."${cutoff}"`);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: used, error: usedError } = await db
    .from('titles')
    .select('id', { count: 'exact', head: true })
    .gte('imdb_rating_updated_at', since);
  if (usedError) {
    console.error(usedError);
    return Response.json({ error: 'Nem sikerült lekérdezni a címeket.' }, { status: 500 });
  }
  const budget = Math.min(BATCH, Math.max(0, DAILY_OMDB - (used ?? 0)));
  if (budget === 0) return Response.json({ updated: [], remaining: 0 }); // holnap folytatja

  const { data: batch, error } = await due(db.from('titles').select('id, imdb_id'))
    .order('imdb_rating_updated_at', { ascending: true, nullsFirst: true })
    .limit(budget);
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
          const rating = await fetchImdbRating(t.imdb_id);
          // ha most nincs adat (a cím hibája, kódaudit #10), a meglévő értékelés marad; csak az
          // időbélyeg frissül, hogy a cím 14 napig ne legyen újra esedékes
          const fields = {
            ...(Object.values(rating).some((x) => x != null) ? rating : {}),
            imdb_rating_updated_at: new Date().toISOString(),
          };
          // az új updated_at is visszamegy: e nélkül a helyben tárolt lista leírása elavultnak látszana (R29)
          const { data: row, error: updateError } = await db
            .from('titles')
            .update(fields)
            .eq('id', t.id)
            .select('updated_at')
            .single();
          if (updateError) throw updateError;
          updated.push({ id: t.id, ...fields, updated_at: row.updated_at });
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
