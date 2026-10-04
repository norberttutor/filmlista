import { supabase } from '@/lib/supabase';

// Mentések (12_backups.sql): hétfőnként automatikus mentés az adatbázisban, a 8 hétnél
// régebbiek törlődnek. Innen: a lista, mentés most, visszaállítás.

export const BACKUP_KINDS = {
  weekly: 'Heti',
  manual: 'Kézi',
  before_restore: 'Visszaállítás előtt',
  imported: 'Feltöltött',
};

// a legújabb elöl (a mentés tartalma nélkül – az nagy, és itt nem kell)
export async function listBackups() {
  const { data, error } = await supabase
    .from('backups')
    .select('id, kind, created_at, title_count')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) {
    console.error(error);
    throw new Error('Nem sikerült betölteni a mentéseket. Frissítsd az oldalt, és próbáld újra.');
  }
  return data;
}

// visszaadja az új mentés azonosítóját; üres listánál null (nincs mit menteni)
export async function createBackup() {
  const { data, error } = await supabase.rpc('create_my_backup');
  if (error) {
    console.error(error);
    throw new Error('Nem sikerült a mentés. Próbáld újra pár perc múlva.');
  }
  return data;
}

// a lista a mentés állapotára áll vissza (előtte a mostaniról mentés készül);
// visszaadja a visszaállított címek számát. Egy lépésben fut: hibánál semmi nem változik.
export async function restoreBackup(id) {
  const { data, error } = await supabase.rpc('restore_my_backup', { p_backup_id: id });
  if (error) {
    console.error(error);
    throw new Error('Nem sikerült a visszaállítás, a listád nem változott. Frissítsd az oldalt, és próbáld újra.');
  }
  return data;
}
