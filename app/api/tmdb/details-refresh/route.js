import { getUserFromRequest, supabaseAsUser, unauthorized } from '@/lib/server/auth';
import { tmdbFetch, yearOf, pickOverview } from '@/lib/server/tmdb';
import { budapestToday, detailsDue } from '@/lib/refreshDue';
import { fetchAll } from '@/lib/fetchAll';

const BATCH = 40; // egy kérésben legfeljebb ennyi cím (a szerverfüggvény időkorlátja miatt)
const PARALLEL = 8;
const FIELDS = 'id, media_type, tmdb_id, status, title, original_title, overview, poster_path, release_date, release_year, details_checked_at, created_at';
const DUE_FIELDS = 'id, tmdb_id, status, release_date, details_checked_at, created_at'; // = detailsDue() mezői

// POST /api/tmdb/details-refresh  (törzs nélkül: a háttérfrissítés; { id }: egy cím, kézzel – az adatlap
// „Frissítés a TMDB-ről” linkje, esedékességtől függetlenül)
// Frissítés a TMDB-ről (terv-3 83, 2026-10-14): a bejelentett / friss címek magyar adatai gyakran csak
// később kerülnek a TMDB-re. A felhasználó jogaival (RLS); a saját adatokhoz (állapot, csillag, franchise,
// Mama, letöltve) nem nyúl. Ami változhat:
//   - cím: csak ha most az eredeti cím áll ott (felvételkor még nem volt magyar) – a kézzel adott címek
//     (pl. a Marvel-import „Pókember 2.1”) így maradnak (Norbi döntése, 2026-10-14);
//   - leírás (magyarul, ha nincs: angolul), borító, pontos dátum (+ év), műfajok – ha a TMDB-n más.
// Esedékes: lib/refreshDue.js detailsDue() (a böngésző is azzal dönti el, hív-e). Ha a cím már nincs a
// TMDB-n, csak megjelöli.
// Válasz: { updated: [a változott címek sora a titles_with_genres nézetből], remaining } | egy címnél
// { row, changed }
export async function POST(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();
  const db = supabaseAsUser(request);
  const body = await request.json().catch(() => null);
  const single = body?.id != null ? Number(body.id) : null;
  if (single != null && (!Number.isInteger(single) || single <= 0)) {
    return Response.json({ error: 'Hibás kérés: az id pozitív egész szám.' }, { status: 400 });
  }

  let batch;
  if (single != null) {
    const { data, error } = await db.from('titles').select(FIELDS).eq('id', single).maybeSingle();
    if (error || !data) {
      if (error) console.error(error);
      return Response.json({ error: 'Ez a cím nincs a listádon.' }, { status: 404 });
    }
    batch = [data];
  } else {
    // az esedékesség csak a kis oszlopokból (ezres adagokban – lib/fetchAll.js), a teljes sor (leírással)
    // csak az első 40 esedékesé (átnézés J11)
    const { data, error } = await fetchAll(() => db.from('titles').select(DUE_FIELDS).order('id'));
    if (error) {
      console.error(error);
      return Response.json({ error: 'Nem sikerült lekérdezni a címeket.' }, { status: 500 });
    }
    const today = budapestToday();
    const due = data.filter((t) => detailsDue(t, today));
    const ids = due.slice(0, BATCH).map((t) => t.id);
    batch = [];
    if (ids.length) {
      const { data: rows, error: rowsError } = await db.from('titles').select(FIELDS).in('id', ids).order('id');
      if (rowsError) {
        console.error(rowsError);
        return Response.json({ error: 'Nem sikerült lekérdezni a címeket.' }, { status: 500 });
      }
      batch = rows;
    }
    batch.remaining = due.length - batch.length;
  }

  // a címek mostani műfajai (az eltérés eldöntéséhez)
  const { data: links, error: linkError } = await db
    .from('title_genres')
    .select('title_id, genre_id')
    .in('title_id', batch.map((t) => t.id));
  if (linkError) {
    console.error(linkError);
    return Response.json({ error: 'Nem sikerült lekérdezni a műfajokat.' }, { status: 500 });
  }
  const genresOf = new Map(batch.map((t) => [t.id, new Set()]));
  for (const l of links) genresOf.get(l.title_id)?.add(l.genre_id);

  const changedIds = [];
  let failed = false; // pl. a TMDB nem elérhető: most nem próbálkozunk tovább
  for (let i = 0; i < batch.length && !failed; i += PARALLEL) {
    await Promise.all(
      batch.slice(i, i + PARALLEL).map(async (t) => {
        try {
          if (await refreshOne(db, t, genresOf.get(t.id))) changedIds.push(t.id);
        } catch (err) {
          console.error(err);
          failed = true;
        }
      })
    );
  }

  let rows = [];
  if (changedIds.length) {
    const { data, error } = await db.from('titles_with_genres').select('*').in('id', changedIds);
    if (error) console.error(error);
    rows = data ?? [];
  }

  if (single != null) {
    if (failed) {
      return Response.json({ error: 'Nem sikerült frissíteni a TMDB-ről. Próbáld újra később.' }, { status: 502 });
    }
    let row = rows[0];
    if (!row) ({ data: row } = await db.from('titles_with_genres').select('*').eq('id', single).single());
    return Response.json({ row, changed: changedIds.length > 0 });
  }
  return Response.json({ updated: rows, remaining: failed ? 0 : batch.remaining });
}

// egy cím frissítése; igaz, ha valami változott (a details_checked_at mindig bekerül)
async function refreshOne(db, t, genreIds) {
  let data = null;
  try {
    data = await tmdbFetch(`/${t.media_type}/${t.tmdb_id}`, { language: 'hu-HU', append_to_response: 'translations' });
  } catch (err) {
    if (err.status !== 404) throw err; // a TMDB-n már nincs meg: csak megjelöljük
  }

  const changes = {};
  if (data) {
    const name = data.title ?? data.name;
    if (name && t.title === t.original_title && name !== t.title) changes.title = name;
    const overview = pickOverview(data);
    if (overview && overview !== t.overview) changes.overview = overview;
    if (data.poster_path && data.poster_path !== t.poster_path) changes.poster_path = data.poster_path;
    const date = (data.release_date ?? data.first_air_date) || null;
    if (date && date !== t.release_date) {
      changes.release_date = date;
      changes.release_year = yearOf(date);
    }
  }

  const genres = (data?.genres ?? []).filter((g) => g.id && g.name);
  const genresChanged =
    genres.length > 0 && (genres.length !== genreIds.size || genres.some((g) => !genreIds.has(g.id)));
  if (genresChanged) {
    const { error: upsertError } = await db.from('genres').upsert(genres.map((g) => ({ id: g.id, name: g.name })));
    if (upsertError) throw upsertError;
    const { error: delError } = await db.from('title_genres').delete().eq('title_id', t.id);
    if (delError) throw delError;
    const { error: insError } = await db
      .from('title_genres')
      .insert(genres.map((g) => ({ title_id: t.id, genre_id: g.id })));
    if (insError) throw insError;
  }

  const { error } = await db
    .from('titles')
    .update({ ...changes, details_checked_at: new Date().toISOString() })
    .eq('id', t.id);
  if (error) throw error;
  return genresChanged || Object.keys(changes).length > 0;
}
