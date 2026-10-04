import { getUserFromRequest, supabaseAsUser, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, pickReleaseDates } from '@/lib/server/tmdb';

const BATCH = 40; // egy kérésben legfeljebb ennyi film (a szerverfüggvény időkorlátja miatt)
const PARALLEL = 8;
const RECHECK_DAYS = 3;

const budapestToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Budapest' });
const addDays = (iso, n) => new Date(Date.parse(iso) + n * 864e5).toISOString().slice(0, 10);

// melyik filmet kell (újra) megnézni: meg nem nézett, tavalyi / idei / jövőbeli (vagy év nélküli),
// 3 napja nem néztük, és a digitális megjelenése nem régebbi 30 napnál (utána már nem változik)
function due(t, today) {
  const year = Number(today.slice(0, 4));
  if (t.status === 'watched') return false;
  if (t.release_year != null && t.release_year < year - 1) return false;
  if (t.digital_release && t.digital_release <= addDays(today, -30)) return false;
  return !t.release_checked_at || Date.parse(t.release_checked_at) < Date.now() - RECHECK_DAYS * 864e5;
}

// POST /api/tmdb/releases
// A belépett felhasználó filmjeinél frissíti a megjelenési dátumokat a TMDB-ről (mozi,
// digitális – magyar, ha nincs, amerikai), a felhasználó jogaival (RLS). A Watchlist betöltéskor
// hívja, adagonként. Válasz: { updated: [{ id, theatrical_release, digital_release,
// release_checked_at }], remaining }
export async function POST(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const db = supabaseAsUser(request);
  const { data: movies, error } = await db
    .from('titles')
    .select('id, tmdb_id, status, release_year, digital_release, release_checked_at')
    .eq('media_type', 'movie')
    .order('id');
  if (error) {
    console.error(error);
    return Response.json({ error: 'Nem sikerült lekérdezni a filmeket.' }, { status: 500 });
  }
  const today = budapestToday();
  const todo = movies.filter((t) => due(t, today));
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
