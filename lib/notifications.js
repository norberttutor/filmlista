import { supabase } from '@/lib/supabase';
import { reportError } from '@/lib/errorLog';

// Értesítések (új évad – 10_notifications.sql; film digitális megjelenése –
// 14_release_dates.sql; új rész egy franchise TMDB-gyűjteményében – 21_collection_parts.sql, ezt a
// lib/titles.js refreshCollectionParts() írja). Betöltéskor előbb az adatbázis megírja a közben megjelent évadokról és
// filmekről szólókat, aztán jön a legutóbbi 30 (a töröltek – dismissed_at – nélkül). collect: false – csak a
// lista (az élő szinkron – terv-3 86 – egy már megírt értesítésre tölt újra; a gyűjtés újabb sort írna)
// a harangban megjelenők: a törölt (pl. épp visszavonható törlés alatt álló) cím / franchise
// értesítése nem látszik. A harang és az app ikonjának száma is ebből számol (kódaudit #20).
// Mama visszavont „Érdekel”-je (vagy utólagos „Nem érdekel”-je) után a „Mamát érdekli” sem látszik (S4).
// titles: Map (id → sor); franchises: amin a .has(id) működik (Map / Set)
export function shownNotifications(notifications, titles, franchises) {
  // a követett személy új filmje (M4) nem címhez kötődik: mindig látszik
  return notifications.filter((n) =>
    n.kind === 'person_new'
      ? true
      : n.kind === 'collection_new'
        ? franchises.has(n.franchise_id)
        : n.kind === 'mama_interested'
          ? MAMA_WANTED.has(titles.get(n.title_id)?.mama_status)
          : titles.has(n.title_id)
  );
}
const MAMA_WANTED = new Set(['interested', 'received']);

export async function loadNotifications({ collect = true } = {}) {
  if (collect) {
    const collected = await Promise.all([
      supabase.rpc('collect_season_notifications'),
      supabase.rpc('collect_release_notifications'),
    ]);
    for (const { error: collectError } of collected) {
      if (collectError) console.warn('Értesítések gyűjtése sikertelen:', collectError.message);
    }
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title_id, season_number, kind, air_date, created_at, read_at, franchise_id, part_tmdb_id, part_title, part_poster_path, part_year, person_id, person_name, person_profile_path')
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(30);
  if (error) {
    reportError(error);
    throw new Error('Nem sikerült betölteni az értesítéseket.');
  }
  return data;
}

// a harang kinyitásakor a látott (betöltött) olvasatlanok olvasottak lesznek – csak ezek: ami közben
// keletkezett (pl. Mama jelölése), de még nem töltődött be, olvasatlan marad
export async function markNotificationsRead(ids) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .is('read_at', null);
  if (error) console.warn('Az értesítések olvasottra állítása sikertelen:', error.message);
}

// törlés a harangból (18_notification_dismiss.sql): a sor csak elrejtett lesz, így a gyűjtők nem
// írják újra; a visszavonás (restore) újra láthatóvá teszi
export async function dismissNotifications(ids) {
  const { error } = await supabase.from('notifications').update({ dismissed_at: new Date().toISOString() }).in('id', ids);
  if (error) {
    reportError(error);
    throw new Error('Nem sikerült törölni az értesítést. Próbáld újra.');
  }
}

export async function restoreNotifications(ids) {
  const { error } = await supabase.from('notifications').update({ dismissed_at: null }).in('id', ids);
  if (error) {
    reportError(error);
    throw new Error('Nem sikerült visszahozni az értesítést. Próbáld újra.');
  }
}
