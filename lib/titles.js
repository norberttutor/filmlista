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
  const { genres, ...title } = await apiGet('/api/tmdb/details', {
    type: media_type,
    id: tmdb_id,
  });

  // 1. műfajok: a TMDB ID a kulcs, a név magyarul frissül
  if (genres.length > 0) {
    const { error } = await supabase.from('genres').upsert(genres);
    if (error) throw saveError(error);
  }

  // 2. maga a cím (user_id és status az adatbázis alapértéke)
  const { data: inserted, error: insertError } = await supabase
    .from('titles')
    .insert(title)
    .select('id')
    .single();
  if (insertError) {
    if (insertError.code === '23505') throw new Error('Ez a cím már a listádon van.');
    throw saveError(insertError);
  }

  // 3. cím ↔ műfaj kapcsolatok; ha nem sikerül, a címet is visszavonjuk,
  //    hogy ne maradjon félig mentett, műfaj nélküli sor
  if (genres.length > 0) {
    const { error } = await supabase
      .from('title_genres')
      .insert(genres.map((g) => ({ title_id: inserted.id, genre_id: g.id })));
    if (error) {
      await supabase.from('titles').delete().eq('id', inserted.id);
      throw saveError(error);
    }
  }

  return fetchTitleRow(inserted.id);
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
