// Franchise-javaslat (terv-3 35, Norbi döntése: az app csak felajánlja, magától nem rendel hozzá).
// Egy franchise nélküli film akkor tartozik egy franchise-odhoz, ha a TMDB-gyűjteménye
// (titles.tmdb_collection_id – felvételkor, illetve a háttérben a /api/tmdb/title-collections tölti)
// a franchise-é: a franchise valamelyik filmjének gyűjteménye, vagy kézzel hozzárendelt gyűjtemény
// (franchises.tmdb_collection_ids). Mindez a betöltött listából, további lekérés nélkül.

// gyűjtemény → a hozzá tartozó franchise azonosítója. Ha több franchise-hoz is tartozik (pl. egy
// „Marvel” és egy „Bosszúállók” franchise), a kézzel hozzárendelés nyer, aztán az, amelyikben több
// filmje van, végül a név szerinti első (a franchises lista név szerint rendezett).
export function collectionFranchiseMap(titles, franchises) {
  const score = new Map(); // gyűjtemény → Map(franchise → pont)
  const add = (collection, franchise, points) => {
    if (!score.has(collection)) score.set(collection, new Map());
    const m = score.get(collection);
    m.set(franchise, (m.get(franchise) ?? 0) + points);
  };
  const known = new Set(franchises.map((f) => f.id));
  for (const f of franchises) for (const c of f.tmdb_collection_ids ?? []) add(c, f.id, 1000);
  for (const t of titles) {
    if (t.franchise_id != null && t.tmdb_collection_id != null && known.has(t.franchise_id)) {
      add(t.tmdb_collection_id, t.franchise_id, 1);
    }
  }
  const order = new Map(franchises.map((f, i) => [f.id, i]));
  const result = new Map();
  for (const [collection, m] of score) {
    const [best] = [...m].sort((a, b) => b[1] - a[1] || order.get(a[0]) - order.get(b[0]));
    result.set(collection, best[0]);
  }
  return result;
}

// a címhez javasolt franchise azonosítója, vagy null (van már franchise-a, elutasította, nincs
// gyűjteménye, vagy a gyűjteménye egyik franchise-odé sem)
export function suggestedFranchiseId(t, map) {
  if (t.media_type !== 'movie' || t.franchise_id != null || t.franchise_suggestion_off) return null;
  if (t.tmdb_collection_id == null) return null;
  return map.get(t.tmdb_collection_id) ?? null;
}

// a Franchise-ok ablak „Javasolt hozzárendelések” listája: [{ title, franchise }], franchise
// szerint, azon belül megjelenés szerint
export function franchiseSuggestions(titles, franchises) {
  const map = collectionFranchiseMap(titles, franchises);
  const byId = new Map(franchises.map((f) => [f.id, f]));
  return titles
    .map((t) => ({ title: t, franchise: byId.get(suggestedFranchiseId(t, map)) }))
    .filter((s) => s.franchise)
    .sort(
      (a, b) =>
        a.franchise.name.localeCompare(b.franchise.name, 'hu') ||
        (a.title.release_year ?? 9999) - (b.title.release_year ?? 9999) ||
        a.title.title.localeCompare(b.title.title, 'hu')
    );
}

// névelő a franchise neve elé: „az Alien”, „a Dűne” (magánhangzóval kezdődőnél „az”)
export function article(name) {
  return /^[aáeéiíoóöőuúüű]/i.test(name.trim()) ? 'az' : 'a';
}
