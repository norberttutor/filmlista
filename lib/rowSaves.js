// Egy sor gyors egymás utáni optimista mentései (kódaudit #9, 2026-10-09). Soronként (cím-id)
// nyilvántartja a függő módosításokat: a képernyőn mindig az utolsó szerversor + a még függő
// módosítások látszanak. A kérések soronként egymás után mennek (a válaszok nem cserélődhetnek
// fel); hibánál csak a sikertelen módosítás esik ki, a többi (a sikeres és a még függő) marad.
// Korábban minden mentés a saját előtti pillanatképére állt vissza, és ezzel a közben tett
// másik módosítást is eltüntette a képernyőről.

const rows = new Map(); // cím-id → { base: utolsó ismert sor, pending: [{ apply }], tail }

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
  const view = () => entry.pending.reduce((row, o) => o.apply(row), entry.base);
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
