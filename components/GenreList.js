import { genreColor } from '@/lib/genreColors';

// A cím műfajai, mindegyik előtt kis színes pöttyel (a szín: genreColor). Felolvasónak
// vesszővel elválasztva, ahogy eddig.
export default function GenreList({ genres, className }) {
  if (!genres?.length) return null;
  return (
    <p className={className}>
      {genres.map((g, i) => (
        <span key={g} className="genre" style={{ '--genre': genreColor(g) }}>
          {g}
          {i < genres.length - 1 && <span className="sr-only">, </span>}
        </span>
      ))}
    </p>
  );
}
