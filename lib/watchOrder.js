import { supabase } from '@/lib/supabase';
import { seasonAired, todayDate, DROPPED_STATUS } from '@/lib/titles';
import { fetchAll } from '@/lib/fetchAll';

// Nézési sorrend a franchise-okban (terv-3 28): a franchise listán lévő filmjei és a sorozatok
// évadjai külön tételként, saját sorrendben (franchise_order tábla – 15_franchise_order.sql).
// Csak a sorrend tárolódik; a megnézett állapot a címekből / évadokból jön. Amíg nincs tárolt
// sorrend, megjelenés szerint; a tárolt sorrendben nem szereplő (új) tételek a végére kerülnek
// (Norbi döntése), egymás közt megjelenés szerint.

// van-e évadlistája (mint a Seasons.js hasSeasons-e)
const hasSeasons = (t) => t.media_type === 'tv' && t.seasons?.length > 0;

// a tétel kulcsa: "címId:évad" (0 = film vagy évad nélküli sorozat)
export const itemKey = (titleId, season = 0) => `${titleId}:${season}`;

// megjelenés szerinti kulcs (ISO dátum); dátum nélkül a végére
function releaseKey(t, s) {
  if (s) return s.air_date ?? '9999-12-31';
  const date = t.theatrical_release ?? t.digital_release;
  if (date) return date;
  return t.release_year ? `${t.release_year}-07-01` : '9999-12-31';
}

const byRelease = (a, b) =>
  a.release.localeCompare(b.release) || a.title.id - b.title.id || a.season - b.season;

// Egy tétel: { key, title, season (évadszám, 0: film / évad nélküli sorozat), seasonInfo (az évad
// sora), status (évadnál az évadé; abbahagyott sorozat meg nem nézett évadja: Abbahagyva),
// downloaded, aired (megjelent-e – a bejelentett évad nem jelölhető), release }
export function franchiseItems(franchiseId, titles, today = todayDate()) {
  const items = [];
  for (const t of titles) {
    if (t.franchise_id !== franchiseId) continue;
    if (hasSeasons(t)) {
      for (const s of t.seasons) {
        items.push({
          key: itemKey(t.id, s.season_number),
          title: t,
          season: s.season_number,
          seasonInfo: s,
          status: s.status !== 'watched' && t.status === DROPPED_STATUS ? DROPPED_STATUS : s.status,
          downloaded: s.is_downloaded,
          aired: seasonAired(s, today),
          release: releaseKey(t, s),
        });
      }
    } else {
      items.push({
        key: itemKey(t.id),
        title: t,
        season: 0,
        seasonInfo: null,
        status: t.status,
        downloaded: t.is_downloaded,
        aired: true,
        release: releaseKey(t, null),
      });
    }
  }
  return items;
}

// A franchise tételei a nézési sorrendben. rows: a franchise_order sorai (bármelyik franchise-é).
// Visszaad: { items, stored } – stored: van-e a franchise-nak tárolt sorrendje (legalább egy
// tárolt tétel ma is a franchise-ban van).
export function orderedItems(franchiseId, titles, rows) {
  const items = franchiseItems(franchiseId, titles);
  const position = new Map(
    rows.filter((r) => r.franchise_id === franchiseId).map((r) => [itemKey(r.title_id, r.season_number), r.position])
  );
  const placed = items.filter((i) => position.has(i.key)).sort((a, b) => position.get(a.key) - position.get(b.key));
  const rest = items.filter((i) => !position.has(i.key)).sort(byRelease);
  return { items: [...placed, ...rest], stored: placed.length > 0 };
}

// a franchise-ok, amelyeknek van tárolt (és ma is érvényes) sorrendje
export function franchisesWithOrder(titles, rows) {
  const current = new Map(titles.map((t) => [t.id, t.franchise_id]));
  return new Set(rows.filter((r) => current.get(r.title_id) === r.franchise_id).map((r) => r.franchise_id));
}

// megnézett-e (kihúzva); a „Következik” az első meg nem nézett, megjelent, nem abbahagyott tétel
export const itemDone = (item) => item.status === 'watched';
export const nextItem = (items) => items.find((i) => !itemDone(i) && i.aired && i.status !== DROPPED_STATUS);

// a felhasználó összes tárolt sorrendje (betöltéskor)
export async function loadOrders() {
  const { data, error } = await fetchAll(() =>
    supabase
      .from('franchise_order')
      .select('franchise_id, title_id, season_number, position')
      .order('franchise_id')
      .order('title_id')
      .order('season_number')
  );
  if (error) throw error;
  return data;
}

function orderError(error) {
  console.error(error);
  return new Error(
    'Nem sikerült menteni a nézési sorrendet. Próbáld újra; ha továbbra sem megy, nézd meg a böngésző konzolját (F12).'
  );
}

// A franchise sorrendjének mentése egyben (a tételek sorrendjében). Visszaadja a tárolt sorokat.
export async function saveOrder(franchiseId, items) {
  const list = items.map((i) => ({ title_id: i.title.id, season_number: i.season }));
  const { error } = await supabase.rpc('set_franchise_order', { p_franchise_id: franchiseId, p_items: list });
  if (error) throw orderError(error);
  return list.map((x, i) => ({ franchise_id: franchiseId, ...x, position: i + 1 }));
}

// „Megjelenés szerint”: a tárolt sorrend törlése
export async function clearOrder(franchiseId) {
  const { error } = await supabase.from('franchise_order').delete().eq('franchise_id', franchiseId);
  if (error) throw orderError(error);
}
