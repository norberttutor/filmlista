import { supabase } from '@/lib/supabase';
import { apiGet } from '@/lib/api';

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

// Saját adatok módosítása (status, is_downloaded, mama_status, my_rating, notes, watched_at).
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

// Törlés a listáról; a műfaj-hozzárendelések az adatbázisban automatikusan törlődnek.
export async function deleteTitle(id) {
  const { error } = await supabase.from('titles').delete().eq('id', id);
  if (error) {
    console.error(error);
    throw new Error('Nem sikerült törölni a címet. Próbáld újra pár másodperc múlva.');
  }
}
