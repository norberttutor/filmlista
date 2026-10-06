import { getUserFromRequest, supabaseAsUser, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, pickReleaseDates } from '@/lib/server/tmdb';
import { budapestToday, releaseDue } from '@/lib/refreshDue';
import { fetchAll } from '@/lib/fetchAll';

const BATCH = 40; // egy kérésben legfeljebb ennyi film (a szerverfüggvény időkorlátja miatt)
const PARALLEL = 8;
// melyik filmet kell (újra) megnézni: lib/refreshDue.js releaseDue() (a böngésző is azzal dönti el,
// hív-e egyáltalán)

// POST /api/tmdb/releases
// A belépett felhasználó filmjeinél frissíti a megjelenési dátumokat a TMDB-ről (mozi,
// digitális – magyar, ha nincs, amerikai), a felhasználó jogaival (RLS). A Watchlist betöltéskor
// hívja, adagonként. Válasz: { updated: [{ id, theatrical_release, digital_release,
// release_checked_at }], remaining }
export async function POST(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const db = supabaseAsUser(request);
  // az összes film (ezres adagokban: egy kérés legfeljebb 1000 sort ad – lib/fetchAll.js)
  const { data: movies, error } = await fetchAll(() =>
    db
      .from('titles')
      .select('id, media_type, tmdb_id, status, release_year, digital_release, release_checked_at')
      .eq('media_type', 'movie')
      .order('id')
  );
  if (error) {
    console.error(error);
    return Response.json({ error: 'Nem sikerült lekérdezni a filmeket.' }, { status: 500 });
  }
  const today = budapestToday();
  const todo = movies.filter((t) => releaseDue(t, today));
  const batch = todo.slice(0, BATCH);

  const updated = [];
  let failed = false; // pl. a TMDB nem elérhető: most nem próbálkozunk tovább
  for (let i = 0; i < batch.length && !failed; i += PARALLEL) {
    await Promise.all(
      batch.slice(i, i + PARALLEL).map(async (t) => {
        try {
          let dates = { theatrical_release: null, digital_release: null };
          try {
            const data = await tmdbFetch(`/movie/${t.tmdb_id}/release_dates`);
            dates = pickReleaseDates(data.results);
          } catch (err) {
            if (err.status !== 404) throw err; // a TMDB-n már nincs meg: nincs dátum
          }
          const fields = { ...dates, release_checked_at: new Date().toISOString() };
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
