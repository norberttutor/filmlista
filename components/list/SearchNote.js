'use client';

// Keresésnél a lista fölötti mondat (terv-3 66): elírás javítva, ill. a franchise neve szerinti találatok
// (components/Watchlist.js; f: useListFilters())
import { fold } from '@/lib/listSearch';
import { Hl } from '@/components/Highlight';

export default function SearchNote({ f }) {
  const { query, typedWords, corrected, frMatches } = f;
  return (
    <p className="search-note" role="status">
      {corrected.length > 0 ? (
        <>
          Nincs pontos találat {typedWords.length > 1 ? `erre: „${query.trim()}”` : `a „${query.trim()}” szóra`} – a
          hasonlókat mutatjuk:{' '}
          <b>
            „
            {query
              .trim()
              .split(/\s+/)
              .map((w) => corrected.find((c) => c.from === fold(w))?.label ?? w)
              .join(' ')}
            ”
          </b>
        </>
      ) : (
        <>
          <b>{frMatches.count} cím</b> a franchise neve alapján:{' '}
          {frMatches.names.map((n, i) => (
            <span key={n}>
              {i > 0 && ', '}
              <Hl text={n} />
            </span>
          ))}
        </>
      )}
    </p>
  );
}
