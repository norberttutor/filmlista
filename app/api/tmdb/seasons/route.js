import { getUserFromRequest, supabaseAsUser, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, pickSeasons } from '@/lib/server/tmdb';

const REFRESH_DAYS = 7; // ennél régebben ellenőrzött sorozatok évadait újra megnézzük
const BATCH = 10; // egy kérésben legfeljebb ennyi sorozat (a szerverfüggvény időkorlátja miatt)
const PARALLEL = 5;

// POST /api/tmdb/seasons
// A belépett felhasználó sorozatai közül azoknál, amelyek évadait még nem, vagy 7 napnál
// régebben néztük meg, lekéri a TMDB-ről az évadokat: felveszi az újakat (megjelent vagy
// bejelentett), és frissíti a nevet, az epizódszámot, a megjelenési dátumot. Az állapothoz és
// a "Letöltve" jelzőhöz nem nyúl. A sorozat állapotát az adatbázis újraszámolja (trigger),
// pl. ha egy bejelentett évad közben megjelent.
// Válasz: { updated: [a frissített sorok a titles_with_genres nézetből], remaining }
export async function POST(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const db = supabaseAsUser(request);
  const cutoff = new Date(Date.now() - REFRESH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const due = (query) =>
    query
      .eq('media_type', 'tv')
      .not('tmdb_id', 'is', null)
      .or(`seasons_checked_at.is.null,seasons_checked_at.lt."${cutoff}"`);

  const { data: batch, error } = await due(db.from('titles').select('id, tmdb_id'))
    .order('seasons_checked_at', { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) {
    console.error(error);
    return Response.json({ error: 'Nem sikerült lekérdezni a sorozatokat.' }, { status: 500 });
  }

  const checked = (id) =>
    db.from('titles').update({ seasons_checked_at: new Date().toISOString() }).eq('id', id);

  const done = [];
  let failed = false; // pl. a TMDB most nem érhető el: ebben a körben nem próbálkozunk tovább
  for (let i = 0; i < batch.length && !failed; i += PARALLEL) {
    await Promise.all(
      batch.slice(i, i + PARALLEL).map(async (t) => {
        try {
          const seasons = pickSeasons(await tmdbFetch(`/tv/${t.tmdb_id}`, { language: 'hu-HU' }));
          if (seasons.length > 0) {
            const { error: upsertError } = await db
              .from('title_seasons')
              .upsert(
                seasons.map((s) => ({ title_id: t.id, ...s })),
                { onConflict: 'title_id,season_number' }
              );
            if (upsertError) throw upsertError;
          }
          const { error: checkError } = await checked(t.id);
          if (checkError) throw checkError;
          done.push(t.id);
        } catch (err) {
          console.error(err);
          if (err.status === 404) {
            await checked(t.id); // a TMDB-n már nincs meg: ne ez akassza el a többit
          } else {
            failed = true;
          }
        }
      })
    );
  }

  let updated = [];
  if (done.length > 0) {
    const { data, error: rowsError } = await db
      .from('titles_with_genres')
      .select('*')
      .in('id', done);
    if (rowsError) console.error(rowsError);
    else updated = data;
  }

  const { count } = await due(db.from('titles').select('id', { count: 'exact', head: true }));
  return Response.json({ updated, remaining: failed ? 0 : (count ?? 0) });
}
