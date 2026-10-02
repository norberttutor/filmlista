import { supabase } from '@/lib/supabase';
import { apiGet } from '@/lib/api';

// Egy cím egyedi kulcsa – ugyanaz, mint az adatbázis egyedi megkötése (user nélkül).
export function titleKey(t) {
  return `${t.media_type}:${t.tmdb_id}`;
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

  const { data: row, error: rowError } = await supabase
    .from('titles_with_genres')
    .select('*')
    .eq('id', inserted.id)
    .single();
  if (rowError) {
    console.error(rowError);
    throw new Error('A cím mentve, de a lista nem frissült. Frissítsd az oldalt (F5).');
  }
  return row;
}
