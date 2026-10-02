import { externalLink, formatDate, mamaLabel, DEFAULT_STATUS } from '@/lib/titles';
import { StarsDisplay } from '@/components/StarRating';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

export default function PosterCard({ title: t, franchise, onEdit }) {
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

      <button
        type="button"
        className="edit-btn"
        aria-label={`Szerkesztés: ${t.title}`}
        onClick={() => onEdit(t)}
      >
        <svg
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      </button>

      <h3>{t.title}</h3>
      {t.original_title && t.original_title !== t.title && (
        <p className="original">{t.original_title}</p>
      )}
      {franchise && <p className="card-franchise">Franchise: {franchise}</p>}
      <p className="meta">
        {t.release_year && <span>{t.release_year}</span>}
        <span>{t.media_type === 'tv' ? 'Sorozat' : 'Film'}</span>
        {t.status !== DEFAULT_STATUS && <span className="status-name">{t.status_name}</span>}
        {t.mama_status && <span>Mama: {mamaLabel(t.mama_status)}</span>}
      </p>
      {t.my_rating && (
        <p className="card-stars">
          <StarsDisplay value={t.my_rating} />
        </p>
      )}
      {t.genres?.length > 0 && <p className="genres">{t.genres.join(', ')}</p>}
      <p className="added">
        Hozzáadva: <time dateTime={t.created_at}>{formatDate(t.created_at)}</time>
      </p>
    </article>
  );
}
