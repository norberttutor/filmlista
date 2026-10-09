import { getUserFromRequest, supabaseAsUser, unauthorized } from '@/lib/server/auth';
import { loadCollection } from '@/lib/server/collections';
import { COLLECTION_PARTS_DAYS } from '@/lib/refreshDue';

const BATCH = 8; // egy kérésben legfeljebb ennyi franchise (a szerverfüggvény időkorlátja miatt)
const MAX_COLLECTIONS = 15; // franchise-onként (mint a gyűjtemény-ablakban)

// POST /api/tmdb/collection-parts
// Új rész egy franchise TMDB-gyűjteményében → értesítés (terv-3 36, 21_collection_parts.sql).
// A belépett felhasználó franchise-ai közül a még nem, vagy 7 napnál régebben ellenőrzöttek
// gyűjteményeit (a franchise filmjeinek tmdb_collection_id-ja + a kézzel hozzárendeltek) lekéri a
// TMDB-ről, és összeveti az ismert részekkel (franchise_collection_parts):
// - a franchise első ellenőrzésekor, és egy újonnan hozzá került gyűjteménynél csak megjegyzi a
//   részeket (nem szól – különben a meglévő franchise-ok minden része „új” lenne);
// - utána az új rész → collection_new értesítés, ha nincs a listán (film, TMDB-azonosító szerint)
//   és nem rejtette el („Nem érdekel” – hidden_suggestions); franchise-onként egyszer (egyedi kulcs).
// Ha egy gyűjtemény most nem tölthető le, a franchise-t nem jelöli ellenőrzöttnek (legközelebb újra);
// a TMDB-n már nem létező (404) gyűjtemény üresnek számít.
// Válasz: { notified: az új értesítések száma, remaining: maradt-e esedékes franchise }
export async function POST(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const db = supabaseAsUser(request);
  // esedékes: ugyanaz, mint a lib/refreshDue.js collectionPartsDue()-ja
  const cutoff = new Date(Date.now() - COLLECTION_PARTS_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: batch, error } = await db
    .from('franchises')
    .select('id, tmdb_collection_ids, collections_checked_at')
    .or(`collections_checked_at.is.null,collections_checked_at.lt."${cutoff}"`)
    .order('collections_checked_at', { ascending: true, nullsFirst: true })
    .order('id')
    .limit(BATCH);
  if (error) {
    console.error(error);
    return Response.json({ error: 'Nem sikerült lekérdezni a franchise-okat.' }, { status: 500 });
  }
  if (batch.length === 0) return Response.json({ notified: 0, remaining: false });

  const ids = batch.map((f) => f.id);
  const [titlesRes, knownRes] = await Promise.all([
    db.from('titles').select('franchise_id, tmdb_collection_id').in('franchise_id', ids).not('tmdb_collection_id', 'is', null),
    db.from('franchise_collection_parts').select('franchise_id, collection_id, tmdb_id').in('franchise_id', ids),
  ]);
  if (titlesRes.error || knownRes.error) {
    console.error(titlesRes.error ?? knownRes.error);
    return Response.json({ error: 'Nem sikerült lekérdezni a gyűjteményeket.' }, { status: 500 });
  }

  // franchise → gyűjtemények; franchise → gyűjtemény → ismert részek
  const collectionsOf = new Map(batch.map((f) => [f.id, new Set(f.tmdb_collection_ids ?? [])]));
  for (const t of titlesRes.data) collectionsOf.get(t.franchise_id).add(t.tmdb_collection_id);
  const known = new Map();
  for (const k of knownRes.data) {
    const byCollection = known.get(k.franchise_id) ?? new Map();
    const parts = byCollection.get(k.collection_id) ?? new Set();
    parts.add(k.tmdb_id);
    byCollection.set(k.collection_id, parts);
    known.set(k.franchise_id, byCollection);
  }

  const newParts = []; // franchise_collection_parts sorok
  const candidates = []; // { franchise_id, part }
  const checked = [];
  for (const f of batch) {
    const collections = [...collectionsOf.get(f.id)].slice(0, MAX_COLLECTIONS);
    // a TMDB-n már nem létező (törölt / összevont) gyűjtemény (404) üresnek számít – különben a
    // franchise örökre esedékes maradna, és soha nem szólna (kódaudit #4)
    const loaded = await Promise.all(
      collections.map((id) => loadCollection(id).catch((err) => (err.status === 404 ? { id, parts: [] } : null)))
    );
    if (loaded.some((c) => c === null)) continue; // a TMDB most nem érhető el: legközelebb újra
    const knownHere = known.get(f.id) ?? new Map();
    for (const c of loaded) {
      const seen = knownHere.get(c.id);
      // első ellenőrzés vagy újonnan hozzá került gyűjtemény: csak megjegyezzük
      const silent = f.collections_checked_at == null || !seen;
      for (const part of c.parts) {
        if (seen?.has(part.tmdb_id)) continue;
        newParts.push({ franchise_id: f.id, collection_id: c.id, tmdb_id: part.tmdb_id });
        if (!silent) candidates.push({ franchise_id: f.id, part });
      }
    }
    checked.push(f.id);
  }

  // a listán lévő és az elrejtett részekről nem szólunk
  let notify = [];
  if (candidates.length > 0) {
    const tmdbIds = [...new Set(candidates.map((c) => c.part.tmdb_id))];
    const [onList, hidden] = await Promise.all([
      db.from('titles').select('tmdb_id').eq('media_type', 'movie').in('tmdb_id', tmdbIds),
      db.from('hidden_suggestions').select('tmdb_id').eq('media_type', 'movie').in('tmdb_id', tmdbIds),
    ]);
    if (onList.error || hidden.error) {
      console.error(onList.error ?? hidden.error);
      return Response.json({ error: 'Nem sikerült lekérdezni a listát.' }, { status: 500 });
    }
    const skip = new Set([...onList.data, ...hidden.data].map((r) => r.tmdb_id));
    // ugyanaz a rész a franchise két gyűjteményében is lehet: egyszer
    const once = new Map(candidates.map((c) => [`${c.franchise_id}:${c.part.tmdb_id}`, c]));
    notify = [...once.values()].filter((c) => !skip.has(c.part.tmdb_id));
  }

  // előbb az értesítés, utána az ismert részek: ha a kettő között hiba van, a rész nem lesz ismert,
  // és a következő ellenőrzés újra próbálja – fordítva az értesítés végleg elmaradna (kódaudit #3).
  // Az újrapróbálás nem duplikál: az egyedi kulcs (franchise_id, part_tmdb_id) a harangból törölt
  // (dismissed_at) sort is megtartja.
  let notified = 0;
  if (notify.length > 0) {
    const rows = notify.map(({ franchise_id, part }) => ({
      kind: 'collection_new',
      title_id: null,
      season_number: 0,
      franchise_id,
      part_tmdb_id: part.tmdb_id,
      part_title: part.title,
      part_poster_path: part.poster_path,
      part_year: part.release_year,
      air_date: part.release_date,
    }));
    const { data: inserted, error: notifError } = await db
      .from('notifications')
      .upsert(rows, { onConflict: 'franchise_id,part_tmdb_id', ignoreDuplicates: true })
      .select('id');
    if (notifError) {
      console.error(notifError);
      return Response.json({ error: 'Nem sikerült menteni az értesítést.' }, { status: 500 });
    }
    notified = inserted.length;
  }

  if (newParts.length > 0) {
    const { error: partsError } = await db
      .from('franchise_collection_parts')
      .upsert(newParts, { onConflict: 'franchise_id,collection_id,tmdb_id', ignoreDuplicates: true });
    if (partsError) {
      console.error(partsError);
      return Response.json({ error: 'Nem sikerült menteni a gyűjtemények részeit.' }, { status: 500 });
    }
  }

  if (checked.length > 0) {
    const { error: checkedError } = await db
      .from('franchises')
      .update({ collections_checked_at: new Date().toISOString() })
      .in('id', checked);
    if (checkedError) console.error(checkedError);
  }

  return Response.json({ notified, remaining: batch.length === BATCH && checked.length > 0 });
}
