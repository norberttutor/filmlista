'use client';

// Az oldalszámok: az első, az utolsó és a jelenlegi ±1; a hézagok helyén "…"
function pageNumbers(page, pageCount) {
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out = [];
  for (const p of pages) {
    if (out.length && p - out[out.length - 1] > 1) out.push('…');
    out.push(p);
  }
  return out;
}

// Lapozó: ‹ Előző  1 … 4 5 6 … 21  Következő ›  –  „76–100. / 512 cím”
export default function Pagination({ page, pageCount, total, pageSize, onChange }) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav className="pagination" aria-label="Lapozás">
      <button
        type="button"
        className="ghost"
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
      >
        ‹ Előző
      </button>
      <ol>
        {pageNumbers(page, pageCount).map((p, i) =>
          p === '…' ? (
            <li key={`gap-${i}`} className="gap" aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <button
                type="button"
                className="page"
                aria-current={p === page ? 'page' : undefined}
                aria-label={`${p}. oldal`}
                onClick={() => onChange(p)}
              >
                {p}
              </button>
            </li>
          )
        )}
      </ol>
      <button
        type="button"
        className="ghost"
        disabled={page === pageCount}
        onClick={() => onChange(page + 1)}
      >
        Következő ›
      </button>
      <span className="page-info">
        {from}–{to}. / {total} cím
      </span>
    </nav>
  );
}
