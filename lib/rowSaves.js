// Egy sor gyors egymás utáni optimista mentései (kódaudit #9, 2026-10-09). Soronként (cím-id)
// nyilvántartja a függő módosításokat: a képernyőn mindig az utolsó szerversor + a még függő
// módosítások látszanak. A kérések soronként egymás után mennek (a válaszok nem cserélődhetnek
// fel); hibánál csak a sikertelen módosítás esik ki, a többi (a sikeres és a még függő) marad.
// Korábban minden mentés a saját előtti pillanatképére állt vissza, és ezzel a közben tett
// másik módosítást is eltüntette a képernyőről.

const rows = new Map(); // cím-id → { base: utolsó ismert sor, pending: [{ apply }], tail }
const optimistic = new WeakSet(); // a még függő módosításokkal számolt (a szerver által meg nem erősített) sorok

// a sor csak optimista (még nincs mentve): ilyenkor nem kell a mentés mellékhatását helyben utánozni – pl. a
// nézési sorrendből csak a megerősített franchise-váltás veszi ki a címet (kódaudit #21)
export function isOptimistic(row) {
  return optimistic.has(row);
}

// az alap a még függő módosításokkal
function viewOf(entry) {
  if (entry.pending.length === 0) return entry.base;
  const row = entry.pending.reduce((r, o) => o.apply(r), entry.base);
  if (row && typeof row === 'object' && row !== entry.base) optimistic.add(row);
  return row;
}

// current: a sor, ahogy most látszik (ha nincs függő mentése, ez lesz az alap);
// apply(row) → a sor a módosítással (null: nincs optimista változás);
// request() → a szerver válasza (a friss sor, vagy { row, … });
// show(row) → a sor kirajzolása (a lista / az adatlap frissítése).
// A request() eredményét adja vissza; hibánál továbbdobja (a hívó írja ki az üzenetet).
export function saveRow(current, apply, request, show) {
  let entry = rows.get(current.id);
  if (!entry) {
    entry = { base: current, pending: [], tail: Promise.resolve() };
    rows.set(current.id, entry);
  }
  const op = { apply: apply ?? ((row) => row) };
  entry.pending.push(op);
  const view = () => viewOf(entry);
  show(view());

  const run = entry.tail.then(request);
  entry.tail = run.then(
    () => {},
    () => {}
  );
  const finish = (row) => {
    if (row) entry.base = row;
    entry.pending.splice(entry.pending.indexOf(op), 1);
    show(view());
    if (entry.pending.length === 0 && rows.get(current.id) === entry) rows.delete(current.id);
  };
  return run.then(
    (result) => {
      finish(result?.row ?? result);
      return result;
    },
    (err) => {
      finish(null);
      throw err;
    }
  );
}

// van-e a sornak még függő (elküldött, válaszra váró) mentése – az élő szinkron (terv-3 86) ilyenkor nem
// írja felül: a mentés válasza úgyis a teljes, friss sort hozza
export function hasPendingSave(id) {
  return rows.has(id);
}

// A háttérfrissítés (components/list/backgroundRefresh.js) friss adata a függő mentésű sornál az alapba kerül
// (B8; fn: alap → új alap), és a sor a függő módosításokkal együtt látszik – így ha a mentés elbukik, a
// visszaállított sorban is ott a friss adat (pl. új évad). Visszaadja a kirajzolandó sort; null, ha nincs függő mentése.
export function rebasePending(id, fn) {
  const entry = rows.get(id);
  if (!entry) return null;
  entry.base = fn(entry.base);
  return viewOf(entry);
}

// A helyi írások sorszáma címenként (átnézés B1): a lista csendes újratöltése és az élő szinkron újraolvasása a
// kérés indulásakor felírja a sorszámot (writeMark), és az azóta helyben mentett / felvett / törölt címnél a
// helyi állapot az érvényes – a válasz a mentés előtti lehet (különben a cím eltűnt, az állapot visszaugrott).
let writeSeq = 0;
const localWrites = new Map(); // cím-id → az utolsó helyi írás sorszáma

export function noteLocalWrite(id) {
  localWrites.set(id, ++writeSeq);
}

export function writeMark() {
  return writeSeq;
}

export function writtenSince(id, mark) {
  return (localWrites.get(id) ?? 0) > mark;
}
