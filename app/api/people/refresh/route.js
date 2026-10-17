import { getUserFromRequest, supabaseAsUser, unauthorized } from '@/lib/server/auth';
import { loadPerson } from '@/lib/server/people';
import { PEOPLE_DAYS, budapestToday } from '@/lib/refreshDue';

const BATCH = 8; // egy kérésben legfeljebb ennyi személy (a szerverfüggvény időkorlátja miatt)
const RECENT_DAYS = 30; // ennél régebben megjelent „új” filmről nem szól (a TMDB utólag pótolt régi adata)

// POST /api/people/refresh
// Követett színész / rendező új filmje → értesítés (M4, 27_followed_people.sql). A belépett
// felhasználó követettjei közül a még nem, vagy 7 napnál régebben ellenőrzöttek filmjeit (színésznél
// a főszerepek – a stáblista első 3 helye –, rendezőnél a rendezett filmek; animáció / dokumentum /
// talkshow… és önmaga-szerep nélkül) összeveti az ismertekkel (followed_person_credits):
// - ha a személynek még nincs ismert filmje (első ellenőrzés, vagy visszaállítás után), csak megjegyzi
//   őket – különben minden régi filmje „új” lenne;
// - utána az új film → person_new értesítés, ha van megjelenési dátuma (Norbi döntése: csak a
//   dátummal bejelentett), az nem régebbi 30 napnál, nincs a listán és nincs elrejtve („Nem érdekel”);
//   személyenként egyszer (egyedi kulcs).
// Ha a TMDB most nem érhető el, a személyt nem jelöli ellenőrzöttnek (legközelebb újra).
// Válasz: { notified: az új értesítések száma, remaining: maradt-e esedékes személy }
export async function POST(request) {
  if (!(await getUserFromRequest(request))) return unauthorized();

  const db = supabaseAsUser(request);
  // esedékes: ugyanaz, mint a lib/refreshDue.js personDue()-ja
  const cutoff = new Date(Date.now() - PEOPLE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: batch, error } = await db
    .from('followed_people')
    .select('person_id, role, name, profile_path, checked_at')
    .or(`checked_at.is.null,checked_at.lt."${cutoff}"`)
    .order('checked_at', { ascending: true, nullsFirst: true })
    .order('person_id')
    .limit(BATCH);
  if (error) {
    console.error(error);
    return Response.json({ error: 'Nem sikerült lekérdezni a követett személyeket.' }, { status: 500 });
  }
  if (batch.length === 0) return Response.json({ notified: 0, remaining: false });

  const { data: knownRows, error: knownError } = await db
    .from('followed_person_credits')
    .select('person_id, role, tmdb_id')
    .in('person_id', batch.map((p) => p.person_id));
  if (knownError) {
    console.error(knownError);
    return Response.json({ error: 'Nem sikerült lekérdezni az ismert filmeket.' }, { status: 500 });
  }
  const keyOf = (p) => `${p.role}:${p.person_id}`;
  const known = new Map();
  for (const k of knownRows) {
    const set = known.get(keyOf(k)) ?? new Set();
    set.add(k.tmdb_id);
    known.set(keyOf(k), set);
  }

  const today = budapestToday();
  const recent = new Date(Date.parse(today) - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const newCredits = []; // followed_person_credits sorok
  const candidates = []; // { person, film }
  const checked = [];
  for (const p of batch) {
    const loaded = await loadPerson(p.person_id, p.role).catch(() => null);
    if (!loaded) continue; // a TMDB most nem érhető el: legközelebb újra
    const seen = known.get(keyOf(p));
    const silent = !seen || seen.size === 0;
    const films = loaded.credits.filter((c) => c.media_type === 'movie' && c.lead && !c.minor_genre);
    for (const film of films) {
      if (seen?.has(film.tmdb_id)) continue;
      newCredits.push({ person_id: p.person_id, role: p.role, tmdb_id: film.tmdb_id });
      if (!silent && film.release_date && film.release_date >= recent) candidates.push({ person: p, film });
    }
    checked.push(p);
  }

  // a listán lévő és az elrejtett filmekről nem szólunk
  let notify = [];
  if (candidates.length > 0) {
    const tmdbIds = [...new Set(candidates.map((c) => c.film.tmdb_id))];
    const [onList, hidden] = await Promise.all([
      db.from('titles').select('tmdb_id').eq('media_type', 'movie').in('tmdb_id', tmdbIds),
      db.from('hidden_suggestions').select('tmdb_id').eq('media_type', 'movie').in('tmdb_id', tmdbIds),
    ]);
    if (onList.error || hidden.error) {
      console.error(onList.error ?? hidden.error);
      return Response.json({ error: 'Nem sikerült lekérdezni a listát.' }, { status: 500 });
    }
    const skip = new Set([...onList.data, ...hidden.data].map((r) => r.tmdb_id));
    // ugyanaz a személy színészként és rendezőként is követhető: filmenként egyszer
    const once = new Map(candidates.map((c) => [`${c.person.person_id}:${c.film.tmdb_id}`, c]));
    notify = [...once.values()].filter((c) => !skip.has(c.film.tmdb_id));
  }

  // előbb az értesítés, utána az ismert filmek: ha a kettő között hiba van, a film nem lesz ismert,
  // és a következő ellenőrzés újra próbálja (fordítva az értesítés végleg elmaradna). Az
  // újrapróbálás nem duplikál: az egyedi kulcs (user_id, person_id, part_tmdb_id) a harangból törölt
  // sort is megtartja.
  let notified = 0;
  if (notify.length > 0) {
    const rows = notify.map(({ person, film }) => ({
      kind: 'person_new',
      title_id: null,
      season_number: 0,
      person_id: person.person_id,
      person_name: person.name,
      person_profile_path: person.profile_path,
      part_tmdb_id: film.tmdb_id,
      part_title: film.title,
      part_poster_path: film.poster_path,
      part_year: film.release_year,
      air_date: film.release_date,
    }));
    const { data: inserted, error: notifError } = await db
      .from('notifications')
      .upsert(rows, { onConflict: 'user_id,person_id,part_tmdb_id', ignoreDuplicates: true })
      .select('id');
    if (notifError) {
      console.error(notifError);
      return Response.json({ error: 'Nem sikerült menteni az értesítést.' }, { status: 500 });
    }
    notified = inserted.length;
  }

  if (newCredits.length > 0) {
    const { error: creditsError } = await db
      .from('followed_person_credits')
      .upsert(newCredits, { onConflict: 'user_id,person_id,role,tmdb_id', ignoreDuplicates: true });
    if (creditsError) {
      console.error(creditsError);
      return Response.json({ error: 'Nem sikerült menteni az ismert filmeket.' }, { status: 500 });
    }
  }

  const now = new Date().toISOString();
  for (const p of checked) {
    const { error: checkedError } = await db
      .from('followed_people')
      .update({ checked_at: now })
      .eq('person_id', p.person_id)
      .eq('role', p.role);
    if (checkedError) console.error(checkedError);
  }

  return Response.json({ notified, remaining: batch.length === BATCH && checked.length > 0 });
}
