import { formatImdb } from '@/lib/titles';

// "IMDb 8,0" jelvény; rámutatáskor a szavazatok számával. Ha nincs értékelés, semmi.
export default function ImdbBadge({ title }) {
  const imdb = formatImdb(title);
  if (!imdb) return null;
  return (
    <span className="imdb" title={imdb.tooltip}>
      IMDb <b>{imdb.rating}</b>
    </span>
  );
}
