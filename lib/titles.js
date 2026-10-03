import { supabase } from '@/lib/supabase';
import { apiGet, apiPost } from '@/lib/api';

// Egy cím egyedi kulcsa – ugyanaz, mint az adatbázis egyedi megkötése (user nélkül).
export function titleKey(t) {
  return `${t.media_type}:${t.tmdb_id}`;
}

// Alapállapot: a felületen üresen jelenik meg (nincs "Megnézendő" felirat).
export const DEFAULT_STATUS = 'to_watch';

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
export async function addTitle({ media_type, tmdb_id }) {
  const { genres, seasons = [], ...title } = await apiGet('/api/tmdb/details', {
    type: media_type,
    id: tmdb_id,
  });

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
    const { error } = await supabase
      .from('title_seasons')
      .insert(seasons.map((s) => ({ title_id: inserted.id, ...s })));
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
    .insert({ title_id: title.id, season_number: next, air_date: todayDate() });
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
export async function refreshSeasons(onUpdated) {
  for (let round = 0; round < 10; round++) {
    const { updated, remaining } = await apiPost('/api/tmdb/seasons');
    if (updated.length > 0) onUpdated(updated);
    if (!remaining || updated.length === 0) break;
  }
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
