import { supabase } from '@/lib/supabase';

// Értesítések (új évad – 10_notifications.sql; film digitális megjelenése –
// 14_release_dates.sql). Betöltéskor előbb az adatbázis megírja a közben megjelent évadokról és
// filmekről szólókat, aztán jön a legutóbbi 30 (a töröltek – dismissed_at – nélkül).
export async function loadNotifications() {
  const collected = await Promise.all([
    supabase.rpc('collect_season_notifications'),
    supabase.rpc('collect_release_notifications'),
  ]);
  for (const { error: collectError } of collected) {
    if (collectError) console.warn('Értesítések gyűjtése sikertelen:', collectError.message);
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title_id, season_number, kind, air_date, created_at, read_at')
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(30);
  if (error) {
    console.error(error);
    throw new Error('Nem sikerült betölteni az értesítéseket.');
  }
  return data;
}

// minden még olvasatlan olvasott lesz (a harang kinyitásakor)
export async function markNotificationsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) console.warn('Az értesítések olvasottra állítása sikertelen:', error.message);
}

// törlés a harangból (18_notification_dismiss.sql): a sor csak elrejtett lesz, így a gyűjtők nem
// írják újra; a visszavonás (restore) újra láthatóvá teszi
export async function dismissNotifications(ids) {
  const { error } = await supabase.from('notifications').update({ dismissed_at: new Date().toISOString() }).in('id', ids);
  if (error) {
    console.error(error);
    throw new Error('Nem sikerült törölni az értesítést. Próbáld újra.');
  }
}

export async function restoreNotifications(ids) {
  const { error } = await supabase.from('notifications').update({ dismissed_at: null }).in('id', ids);
  if (error) {
    console.error(error);
    throw new Error('Nem sikerült visszahozni az értesítést. Próbáld újra.');
  }
}
