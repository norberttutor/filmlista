import { externalLink, formatDate, mamaLabel, DEFAULT_STATUS } from '@/lib/titles';
import { StarsDisplay } from '@/components/StarRating';
import ImdbBadge from '@/components/ImdbBadge';
import { hasSeasons, seasonCounts, SeasonStrip } from '@/components/Seasons';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

export default function PosterCard({ title: t, franchise, onEdit }) {
  const link = externalLink(t);
  const seasons = hasSeasons(t) ? seasonCounts(t) : null;

  return (
    <article className="card" data-status={t.status}>
      {/* a borítóra kattintva a szerkesztő ablak nyílik (mint a ceruzával; billentyűzettel és
          képernyőolvasóval a ceruza gomb ugyanez); sorozatnál a borító alján évadonként egy
          szakasz, egyébként egy állapotcsík */}
      <div className="poster" onClick={() => onEdit(t)}>
        {t.poster_path ? (
          <img src={POSTER_BASE + t.poster_path} alt="" loading="lazy" />
        ) : (
          <span className="poster-fallback">{t.title}</span>
        )}
        {t.is_downloaded && <span className="badge">Letöltve</span>}
        {seasons ? <SeasonStrip title={t} /> : <span className="status-strip" aria-hidden="true" />}
      </div>

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

      {/* az IMDb- (vagy TMDB-) adatlap a címre kattintva nyílik */}
      <h3>
        {link ? (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${t.title} megnyitása: ${link.site}`}
          >
            {t.title}
          </a>
        ) : (
          t.title
        )}
      </h3>
      {t.original_title && t.original_title !== t.title && (
        <p className="original">{t.original_title}</p>
      )}
      {franchise && <p className="card-franchise">Franchise: {franchise}</p>}
      <p className="meta">
        {t.release_year && <span>{t.release_year}</span>}
        <span>{t.media_type === 'tv' ? 'Sorozat' : 'Film'}</span>
        <ImdbBadge title={t} />
        {t.status !== DEFAULT_STATUS && <span className="status-name">{t.status_name}</span>}
        {seasons && (
          <span>
            {seasons.watched}/{seasons.aired} évad
          </span>
        )}
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
