import { supabase } from '@/lib/supabase';
import { apiGet, apiPost } from '@/lib/api';

// Egy cím egyedi kulcsa – ugyanaz, mint az adatbázis egyedi megkötése (user nélkül).
export function titleKey(t) {
  return `${t.media_type}:${t.tmdb_id}`;
}

// Alapállapot: a felületen üresen jelenik meg (nincs "Megnézendő" felirat).
export const DEFAULT_STATUS = 'to_watch';

// "Abbahagyva": csak sorozatnál választható (nem nézi tovább, de a listán marad). Évados
// sorozatnál is kézi: az évadok változása nem írja felül (09_dropped.sql).
export const DROPPED_STATUS = 'dropped';

// "Mama" jelző értékei; null = nincs megadva (alapértelmezett)
export const MAMA_OPTIONS = [
  { code: 'interested', name: 'Érdekli' },
  { code: 'received', name: 'Megkapta' },
];

export function mamaLabel(code) {
  return MAMA_OPTIONS.find((o) => o.code === code)?.name ?? '';
}

// Külső adatlap: IMDb, ha van IMDb ID, különben TMDB.
export function externalLink(t) {
  if (t.imdb_id) {
    return { href: `https://www.imdb.com/title/${t.imdb_id}/`, site: 'IMDb' };
  }
  if (t.tmdb_id) {
    return { href: `https://www.themoviedb.org/${t.media_type}/${t.tmdb_id}`, site: 'TMDB' };
  }
  return null;
}

const dateFormat = new Intl.DateTimeFormat('hu-HU'); // pl. 2026. 10. 02.

export function formatDate(value) {
  return dateFormat.format(new Date(value));
}

// IMDb-értékelés kijelzéshez: { rating: "8,0", tooltip } vagy null, ha nincs.
export function formatImdb(t) {
  if (t.imdb_rating == null) return null;
  const rating = t.imdb_rating.toLocaleString('hu-HU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const votes = t.imdb_votes ? ` (${t.imdb_votes.toLocaleString('hu-HU')} szavazat)` : '';
  return { rating, tooltip: `IMDb-értékelés: ${rating}${votes}` };
}

// Háttérben pótolja / frissíti az IMDb-értékeléseket (a szerver 25-ösével dolgozik);
// onUpdated a frissített mezőket kapja: [{ id, imdb_rating, imdb_votes, imdb_rating_updated_at }].
export async function refreshImdbRatings(onUpdated) {
  for (let round = 0; round < 10; round++) {
    const { updated, remaining } = await apiPost('/api/imdb/refresh');
    if (updated.length > 0) onUpdated(updated);
    if (!remaining || updated.length === 0) break;
  }
}

// Hiányzó háttérképek pótlása a háttérben (a szerver 40-esével dolgozik); onUpdated a
// frissített mezőket kapja: [{ id, backdrop_path, backdrop_checked_at }].
export async function refreshBackdrops(onUpdated) {
  for (let round = 0; round < 30; round++) {
    const { updated, remaining } = await apiPost('/api/tmdb/backdrops');
    if (updated.length > 0) onUpdated(updated);
    if (!remaining || updated.length === 0) break;
  }
}

// Filmek megjelenési dátumai a háttérben (/api/tmdb/releases, adagonként): a még meg nem
// nézett tavalyi / idei / jövőbeli filmekhez, 3 naponta. Visszaadja a frissített sorok számát.
export async function refreshReleases(onUpdated) {
  let count = 0;
  for (let round = 0; round < 30; round++) {
    const { updated, remaining } = await apiPost('/api/tmdb/releases');
    count += updated.length;
    if (updated.length > 0) onUpdated(updated);
    if (!remaining || updated.length === 0) break;
  }
  return count;
}

const CINEMA_WINDOW_DAYS = 120; // a mozis bemutató után ennyi ideig várjuk a digitális dátumot

// A még meg nem jelent film állapota (a szaggatott kerethez és a jelvényhez), vagy null, ha
// megjelent (illetve sorozat / megnézett). { kind: 'soon', date, year } – a moziba sem került
// még (vagy csak digitálisan jön); { kind: 'cinema', digital } – moziban már, digitálisan még
// nem (a digitális dátum, ha ismert). Dátum nélkül az évből: jövőbeli év (vagy nincs év) → soon.
export function releaseState(t, today = todayDate()) {
  if (t.media_type !== 'movie' || t.status === 'watched') return null;
  const th = t.theatrical_release;
  const dg = t.digital_release;
  if (dg && dg <= today) return null;
  if (th && th > today) return { kind: 'soon', date: th };
  if (dg) return th ? { kind: 'cinema', digital: dg } : { kind: 'soon', date: dg };
  if (th) {
    const since = (Date.parse(today) - Date.parse(th)) / 864e5;
    return since <= CINEMA_WINDOW_DAYS ? { kind: 'cinema', digital: null } : null;
  }
  const year = Number(today.slice(0, 4));
  if (t.release_year == null || t.release_year > year) return { kind: 'soon', year: t.release_year };
  return null;
}

// "okt. 15." (idén) / "2027. márc. 3."
export function formatReleaseDate(iso, today = todayDate()) {
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return new Date(`${iso}T12:00:00`).toLocaleDateString('hu-HU', {
    ...(sameYear ? {} : { year: 'numeric' }),
    month: 'short',
    day: 'numeric',
  });
}

// a jelvény szövege részenként: { word: "Hamarosan" | "Moziban", when: "okt. 15." | "2027" | null,
// sub: "digitálisan: nov. 20." | null } – egyben: „Hamarosan · okt. 15.”, „Moziban · digitálisan: …”
export function releaseLabel(state) {
  if (!state) return null;
  if (state.kind === 'cinema') {
    return { word: 'Moziban', when: null, sub: `digitálisan: ${state.digital ? formatReleaseDate(state.digital) : 'még nincs dátum'}` };
  }
  const when = state.date ? formatReleaseDate(state.date) : state.year ? String(state.year) : null;
  return { word: 'Hamarosan', when, sub: null };
}

// Hiányzó franchise-logók lekérése (a szerver a franchise első filmjének logóját keresi):
// [{ id, logo_path }]
export async function refreshFranchiseLogos() {
  const { updated } = await apiPost('/api/franchises/logos');
  return updated;
}

// mai dátum YYYY-MM-DD formában, helyi idő szerint (a svéd formátum pont ilyen)
export function todayDate() {
  return new Date().toLocaleDateString('sv-SE');
}

function saveError(error) {
  console.error(error);
  return new Error(
    'Nem sikerült menteni a címet. Próbáld újra; ha továbbra sem megy, nézd meg a böngésző konzolját (F12).'
  );
}

// Keresési találat felvétele a listára.
// Visszaadja az új sort a titles_with_genres nézetből, ahogy a lista is használja.
// details: a /api/tmdb/details már lekérdezett válasza (az előnézeti adatlapé), ha van – akkor
// nem kérdezzük le újra.
export async function addTitle({ media_type, tmdb_id }, details = null) {
  const { genres, seasons = [], ...title } =
    details ?? (await apiGet('/api/tmdb/details', { type: media_type, id: tmdb_id }));

  // 1. műfajok: a TMDB ID a kulcs, a név magyarul frissül
  if (genres.length > 0) {
    const { error } = await supabase.from('genres').upsert(genres);
    if (error) throw saveError(error);
  }

  // 2. maga a cím (user_id és status az adatbázis alapértéke); sorozatnál az évadok most
  //    kerülnek fel, a háttérfrissítés csak egy hét múlva nézi meg újra őket
  const { data: inserted, error: insertError } = await supabase
    .from('titles')
    .insert({ ...title, ...(media_type === 'tv' && { seasons_checked_at: new Date().toISOString() }) })
    .select('id')
    .single();
  if (insertError) {
    if (insertError.code === '23505') throw new Error('Ez a cím már a listádon van.');
    throw saveError(insertError);
  }

  // 3. cím ↔ műfaj kapcsolatok és a sorozat évadai; ha nem sikerül, a címet is
  //    visszavonjuk, hogy ne maradjon félig mentett sor
  const undo = async (error) => {
    await supabase.from('titles').delete().eq('id', inserted.id);
    return saveError(error);
  };
  if (genres.length > 0) {
    const { error } = await supabase
      .from('title_genres')
      .insert(genres.map((g) => ({ title_id: inserted.id, genre_id: g.id })));
    if (error) throw await undo(error);
  }
  if (seasons.length > 0) {
    // a már megjelent évadokról nem kell értesítés, csak a bejelentettek megjelenéséről
    const { error } = await supabase
      .from('title_seasons')
      .insert(
        seasons.map((s) => ({ title_id: inserted.id, ...s, aired_notified: seasonAired(s) }))
      );
    if (error) throw await undo(error);
  }

  return fetchTitleRow(inserted.id);
}

// ---------- Évadok (sorozatoknál) ----------
// A sorozat állapotát, "Letöltve" jelzőjét és megnézési dátumát az adatbázis számolja az
// évadokból (trigger); minden évadművelet a sorozat friss sorát adja vissza a nézetből.

// kattintásra: üres → Folyamatban → Megnézve → üres
export const NEXT_SEASON_STATUS = { to_watch: 'watching', watching: 'watched', watched: 'to_watch' };

// Megjelent-e már az évad; a bejelentett (jövőbeli vagy dátum nélküli) nem jelölhető.
export function seasonAired(season, today = todayDate()) {
  return season.air_date != null && season.air_date <= today;
}

function seasonError(error) {
  console.error(error);
  return new Error(
    'Nem sikerült menteni az évadot. Próbáld újra; ha továbbra sem megy, nézd meg a böngésző konzolját (F12).'
  );
}

// Évadok visszaállítása (visszavonás): [{ season_number, status, is_downloaded }]
async function writeSeasons(titleId, seasons) {
  const groups = new Map();
  for (const s of seasons) {
    const key = `${s.status}|${s.is_downloaded}`;
    groups.set(key, [...(groups.get(key) ?? []), s.season_number]);
  }
  for (const [key, numbers] of groups) {
    const [status, downloaded] = key.split('|');
    const { error } = await supabase
      .from('title_seasons')
      .update({ status, is_downloaded: downloaded === 'true' })
      .eq('title_id', titleId)
      .in('season_number', numbers);
    if (error) throw seasonError(error);
  }
}

const snapshot = (title, numbers) =>
  title.seasons
    .filter((s) => numbers.includes(s.season_number))
    .map(({ season_number, status, is_downloaded }) => ({ season_number, status, is_downloaded }));

// Egy évad állapota. Megnézettre állításkor az előtte lévő, még üres (megjelent) évadok is
// megnézettek lesznek. Visszaad: { row, filled: [kitöltött évadszámok], previous } – a
// previous-szal a restoreSeasons() visszavonja.
export async function setSeasonStatus(title, seasonNumber, status) {
  const filled =
    status === 'watched'
      ? title.seasons
          .filter((s) => s.season_number < seasonNumber && s.status === 'to_watch' && seasonAired(s))
          .map((s) => s.season_number)
      : [];
  const numbers = [seasonNumber, ...filled];
  const previous = snapshot(title, numbers);
  const { error } = await supabase
    .from('title_seasons')
    .update({ status })
    .eq('title_id', title.id)
    .in('season_number', numbers);
  if (error) throw seasonError(error);
  return { row: await fetchTitleRow(title.id), filled, previous };
}

// "Mind megnézve": minden megjelent évad megnézett lesz (visszavonható, mint fent)
export async function markAllSeasonsWatched(title) {
  const numbers = title.seasons
    .filter((s) => seasonAired(s) && s.status !== 'watched')
    .map((s) => s.season_number);
  const previous = snapshot(title, numbers);
  if (numbers.length > 0) {
    const { error } = await supabase
      .from('title_seasons')
      .update({ status: 'watched' })
      .eq('title_id', title.id)
      .in('season_number', numbers);
    if (error) throw seasonError(error);
  }
  return { row: await fetchTitleRow(title.id), filled: numbers, previous };
}

export async function restoreSeasons(titleId, previous) {
  await writeSeasons(titleId, previous);
  return fetchTitleRow(titleId);
}

export async function setSeasonDownloaded(titleId, seasonNumber, value) {
  const { error } = await supabase
    .from('title_seasons')
    .update({ is_downloaded: value })
    .eq('title_id', titleId)
    .eq('season_number', seasonNumber);
  if (error) throw seasonError(error);
  return fetchTitleRow(titleId);
}

// Kézi "+ Évad": a következő évadszám, mai megjelenéssel (ha a TMDB még nem tud róla;
// a háttérfrissítés később pontosítja a nevét és a dátumát)
export async function addSeason(title) {
  const next = Math.max(0, ...title.seasons.map((s) => s.season_number)) + 1;
  const { error } = await supabase
    .from('title_seasons')
    .insert({ title_id: title.id, season_number: next, air_date: todayDate(), aired_notified: true });
  if (error) throw seasonError(error);
  return fetchTitleRow(title.id);
}

// Az utolsó évad törlése (pl. tévesen hozzáadott évad). Ha a TMDB-n is szerepel, a heti
// háttérfrissítés üresen visszahozza. A sorozat állapota a maradékból számolódik újra.
export async function removeLastSeason(title) {
  const last = Math.max(...title.seasons.map((s) => s.season_number));
  const { error } = await supabase
    .from('title_seasons')
    .delete()
    .eq('title_id', title.id)
    .eq('season_number', last);
  if (error) throw seasonError(error);
  return fetchTitleRow(title.id);
}

// Hiányzó / egy hétnél régebbi évadadatok pótlása a háttérben (a szerver 10-esével
// dolgozik); onUpdated a frissített sorokat kapja (titles_with_genres).
// Visszaadja a frissített sorok számát.
export async function refreshSeasons(onUpdated) {
  let count = 0;
  for (let round = 0; round < 10; round++) {
    const { updated, remaining } = await apiPost('/api/tmdb/seasons');
    count += updated.length;
    if (updated.length > 0) onUpdated(updated);
    if (!remaining || updated.length === 0) break;
  }
  return count;
}

// Egy cím friss sora a titles_with_genres nézetből (status_name, genres is benne van).
async function fetchTitleRow(id) {
  const { data, error } = await supabase
    .from('titles_with_genres')
    .select('*')
    .eq('id', id)
    .single();
  if (error) {
    console.error(error);
    throw new Error('A módosítás mentve, de a lista nem frissült. Frissítsd az oldalt (F5).');
  }
  return data;
}

// Saját adatok módosítása (status, is_downloaded, mama_status, franchise_id, my_rating,
// notes, watched_at).
// Visszaadja a frissített sort a nézetből.
export async function updateTitle(id, changes) {
  const { error } = await supabase.from('titles').update(changes).eq('id', id);
  if (error) {
    console.error(error);
    throw new Error(
      'Nem sikerült menteni a módosítást. Próbáld újra; ha továbbra sem megy, nézd meg a böngésző konzolját (F12).'
    );
  }
  return fetchTitleRow(id);
}

// Új franchise felvétele; visszaadja: { id, name }.
export async function createFranchise(name) {
  const { data, error } = await supabase
    .from('franchises')
    .insert({ name })
    .select('id, name')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Ilyen nevű franchise már van.');
    console.error(error);
    throw new Error('Nem sikerült menteni a franchise-t. Próbáld újra pár másodperc múlva.');
  }
  return data;
}

// Franchise átnevezése; visszaadja: { id, name }. A cím-hozzárendelések és a logó maradnak.
export async function renameFranchise(id, name) {
  const { data, error } = await supabase
    .from('franchises')
    .update({ name })
    .eq('id', id)
    .select('id, name')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Ilyen nevű franchise már van.');
    console.error(error);
    throw new Error('Nem sikerült átnevezni a franchise-t. Próbáld újra pár másodperc múlva.');
  }
  return data;
}

// A franchise-hoz kézzel hozzárendelt TMDB-gyűjtemények (13_franchise_collections.sql);
// visszaadja: { id, tmdb_collection_ids }.
export async function setFranchiseCollections(id, collectionIds) {
  const { data, error } = await supabase
    .from('franchises')
    .update({ tmdb_collection_ids: collectionIds })
    .eq('id', id)
    .select('id, tmdb_collection_ids')
    .single();
  if (error) {
    console.error(error);
    throw new Error('Nem sikerült menteni a gyűjteményt. Próbáld újra pár másodperc múlva.');
  }
  return data;
}

// Saját értékelések tömeges beírása (IMDb-importból): [{ id, to }].
// Csillagértékenként egy kérés, így legfeljebb 10, akárhány címről van szó.
export async function applyMyRatings(changes) {
  const idsByRating = new Map();
  for (const c of changes) idsByRating.set(c.to, [...(idsByRating.get(c.to) ?? []), c.id]);
  for (const [rating, ids] of idsByRating) {
    const { error } = await supabase.from('titles').update({ my_rating: rating }).in('id', ids);
    if (error) {
      console.error(error);
      throw new Error(
        'Nem sikerült beírni az értékeléseket. Próbáld újra; a már beírtak megmaradnak.'
      );
    }
  }
}

// Franchise törlése; az adatbázis minden címnél üresre állítja (on delete set null).
export async function deleteFranchise(id) {
  const { error } = await supabase.from('franchises').delete().eq('id', id);
  if (error) {
    console.error(error);
    throw new Error('Nem sikerült törölni a franchise-t. Próbáld újra pár másodperc múlva.');
  }
}

// Törlés a listáról; a műfaj-hozzárendelések az adatbázisban automatikusan törlődnek.
export async function deleteTitle(id) {
  const { error } = await supabase.from('titles').delete().eq('id', id);
  if (error) {
    console.error(error);
    throw new Error('Nem sikerült törölni a címet. Próbáld újra pár másodperc múlva.');
  }
}
