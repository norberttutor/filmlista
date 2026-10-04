import { supabase } from '@/lib/supabase';

// Értesítések (új évad – 10_notifications.sql; film digitális megjelenése –
// 14_release_dates.sql). Betöltéskor előbb az adatbázis megírja a közben megjelent évadokról és
// filmekről szólókat, aztán jön a legutóbbi 30.
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
