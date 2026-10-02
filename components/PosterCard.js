const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

function externalLink(t) {
  if (t.imdb_id) {
    return { href: `https://www.imdb.com/title/${t.imdb_id}/`, site: 'IMDb' };
  }
  if (t.tmdb_id) {
    return { href: `https://www.themoviedb.org/${t.media_type}/${t.tmdb_id}`, site: 'TMDB' };
  }
  return null;
}

export default function PosterCard({ title: t }) {
  const link = externalLink(t);

  const poster = (
    <div className="poster">
      {t.poster_path ? (
        <img src={POSTER_BASE + t.poster_path} alt="" loading="lazy" />
      ) : (
        <span className="poster-fallback">{t.title}</span>
      )}
      {t.is_downloaded && <span className="badge">Letöltve</span>}
      <span className="status-strip" aria-hidden="true" />
    </div>
  );

  return (
    <article className="card" data-status={t.status}>
      {link ? (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${t.title} megnyitása: ${link.site}`}
        >
          {poster}
        </a>
      ) : (
        poster
      )}

      <h3>{t.title}</h3>
      {t.original_title && t.original_title !== t.title && (
        <p className="original">{t.original_title}</p>
      )}
      <p className="meta">
        {t.release_year && <span>{t.release_year}</span>}
        <span>{t.media_type === 'tv' ? 'Sorozat' : 'Film'}</span>
        <span className="status-name">{t.status_name}</span>
      </p>
      {t.genres?.length > 0 && <p className="genres">{t.genres.join(', ')}</p>}
    </article>
  );
}
