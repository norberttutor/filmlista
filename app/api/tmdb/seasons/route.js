import { getUserFromRequest, supabaseAsUser, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, pickSeasons } from '@/lib/server/tmdb';
import { budapestToday, SEASONS_REFRESH_DAYS } from '@/lib/refreshDue';

const BATCH = 10; // egy kérésben legfeljebb ennyi sorozat (a szerverfüggvény időkorlátja miatt)
const PARALLEL = 5;

const aired = (s, today) => s.air_date != null && s.air_date <= today;

// POST /api/tmdb/seasons
// A belépett felhasználó sorozatai közül azoknál, amelyek évadait még nem, vagy 7 napnál
// régebben néztük meg, lekéri a TMDB-ről az évadokat: felveszi az újakat (megjelent vagy
// bejelentett), és frissíti a nevet, az epizódszámot, a megjelenési dátumot. Az állapothoz és
// a "Letöltve" jelzőhöz nem nyúl. A sorozat állapotát az adatbázis újraszámolja (trigger),
// pl. ha egy bejelentett évad közben megjelent.
// Értesítés (10_notifications.sql): ha egy már ismert évadlistájú sorozathoz új, még meg nem
// jelent évad érkezik → "bejelentve" értesítés; az új, már megjelent évadról a
// collect_season_notifications() szól (aired_notified = false). Az első feltöltésnél (még nem
// volt évadja) a már megjelentekről nem szólunk. Abbahagyott sorozatról nincs bejelentés.
// Válasz: { updated: [a frissített sorok a titles_with_genres nézetből], remaining }
export async function POST(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const db = supabaseAsUser(request);
  const today = budapestToday();
  // esedékes: ugyanaz, mint a lib/refreshDue.js seasonsDue()-ja (a böngésző azzal dönti el, hív-e)
  const cutoff = new Date(Date.now() - SEASONS_REFRESH_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const due = (query) =>
    query
      .eq('media_type', 'tv')
      .not('tmdb_id', 'is', null)
      .or(`seasons_checked_at.is.null,seasons_checked_at.lt."${cutoff}"`);

  const { data: batch, error } = await due(db.from('titles').select('id, tmdb_id, status'))
    .order('seasons_checked_at', { ascending: true, nullsFirst: true })
    .limit(BATCH);
  if (error) {
    console.error(error);
    return Response.json({ error: 'Nem sikerült lekérdezni a sorozatokat.' }, { status: 500 });
  }

  // a már ismert évadok sorozatonként (ebből derül ki, mi az új)
  const known = new Map(batch.map((t) => [t.id, new Set()]));
  if (batch.length > 0) {
    const { data: rows, error: knownError } = await db
      .from('title_seasons')
      .select('title_id, season_number')
      .in('title_id', batch.map((t) => t.id));
    if (knownError) {
      console.error(knownError);
      return Response.json({ error: 'Nem sikerült lekérdezni az évadokat.' }, { status: 500 });
    }
    for (const r of rows) known.get(r.title_id).add(r.season_number);
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
          const have = known.get(t.id);
          const firstFill = have.size === 0;
          const existing = seasons.filter((s) => have.has(s.season_number));
          const fresh = seasons.filter((s) => !have.has(s.season_number));

          // a meglévők adatai frissülnek (az állapot, a "Letöltve" és a jelzés marad)
          if (existing.length > 0) {
            const { error: upsertError } = await db
              .from('title_seasons')
              .upsert(
                existing.map((s) => ({ title_id: t.id, ...s })),
                { onConflict: 'title_id,season_number' }
              );
            if (upsertError) throw upsertError;
          }
          if (fresh.length > 0) {
            const { error: insertError } = await db.from('title_seasons').upsert(
              fresh.map((s) => ({
                title_id: t.id,
                ...s,
                aired_notified: firstFill && aired(s, today),
              })),
              { onConflict: 'title_id,season_number', ignoreDuplicates: true }
            );
            if (insertError) throw insertError;

            const announced = fresh.filter((s) => !aired(s, today));
            if (!firstFill && t.status !== 'dropped' && announced.length > 0) {
              const { error: noteError } = await db.from('notifications').upsert(
                announced.map((s) => ({
                  title_id: t.id,
                  season_number: s.season_number,
                  kind: 'season_announced',
                  air_date: s.air_date,
                })),
                { onConflict: 'title_id,season_number,kind', ignoreDuplicates: true }
              );
              if (noteError) throw noteError;
            }
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
