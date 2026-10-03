// Csontváz-betöltés: amíg a lista betöltődik, a helyén halvány körvonalak csillogó áthúzással
// (asztali listanézetben sorok, egyébként kártyák). Felolvasónak "Lista betöltése…".
const ROWS = [0, 1, 2, 3, 4, 5];
const CARDS = Array.from({ length: 12 }, (_, i) => i);

export default function ListSkeleton({ table }) {
  return (
    <div className={table ? 'skeleton-table' : 'grid'} aria-busy="true">
      <p className="sr-only" role="status">
        Lista betöltése…
      </p>
      {table
        ? ROWS.map((i) => (
            <div key={i} className="sk-row" aria-hidden="true">
              <span className="sk sk-thumb" />
              <span className="sk-lines">
                <span className="sk sk-line sk-w60" />
                <span className="sk sk-line sk-w40" />
                <span className="sk sk-line sk-w80" />
              </span>
            </div>
          ))
        : CARDS.map((i) => (
            <div key={i} className="sk-card" aria-hidden="true">
              <span className="sk sk-poster" />
              <span className="sk sk-line sk-w80" />
              <span className="sk sk-line sk-w40" />
            </div>
          ))}
    </div>
  );
}
