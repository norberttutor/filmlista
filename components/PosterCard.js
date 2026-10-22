import { useRef, useState } from 'react';
import { externalLink, formatDate, nextSeason, releaseState, DEFAULT_STATUS } from '@/lib/titles';
import { usePosterColor, ambientProps } from '@/lib/posterColor';
import { StarsDisplay } from '@/components/StarRating';
import ImdbBadge from '@/components/ImdbBadge';
import GenreList from '@/components/GenreList';
import { hasSeasons, seasonCounts, SeasonStrip } from '@/components/Seasons';
import ReleaseBadge from '@/components/ReleaseBadge';
import { useDrain, useStrike } from '@/lib/useStrike';
import { useAppearance } from '@/lib/afterDialogs';
import { Hl } from '@/components/Highlight';
import { usePrefetchOnHover } from '@/lib/prefetch';
import { useTheme } from '@/lib/theme';
import { tekaCategory, tekaIsNew, tekaOsd } from '@/lib/teka';

const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

// item: a nézési sorrend tétele (a fő lista „Nézési sorrend” rendezésében, lib/watchOrder.js) –
// évadnál „2. évad” felirat, és az állapot / letöltve az évadé
export default function PosterCard({ title: t, item = null, franchise, onEdit }) {
  const link = externalLink(t);
  const season = item?.season ?? 0;
  const status = item ? item.status : t.status;
  const label = season ? `${t.title} – ${season}. évad` : t.title;
  const strike = useStrike(status); // megnézettre váltáskor kihúzás a címen
  const draining = useDrain(strike); // …és a borító színe kifolyik (terv-3 133)
  const seasons = hasSeasons(t) ? seasonCounts(t) : null;
  // még meg nem jelent film: szaggatott keret a borító körül és dátumos jelvény
  const release = releaseState(t);
  // sorozat bejelentett évada: jelvény a borító alján, de szaggatott keret nélkül – a sorozat már fut
  // (terv-3 84; a nézési sorrend évad-tételén nincs)
  const upcoming = item ? null : nextSeason(t);
  const downloaded = item ? item.downloaded : t.is_downloaded;
  // letöltöttre váltáskor a jelvény lecsúszik a helyére (terv-3 141 a) – az adatlap bezárásakor, addig nem látszik
  const downloadPhase = useAppearance(Boolean(downloaded));
  const mamaWants = t.mama_status === 'interested';
  // a borító hangulatszíne: az első rámutatáskor számolódik, rámutatva a borító ebben fénylik
  const [pointed, setPointed] = useState(false);
  const ambient = usePosterColor(t.poster_path, pointed);
  // a borító: innen siklik át a szerkesztő ablakba (nézetváltás)
  const posterRef = useRef(null);
  // rámutatáskor az adatlap adatai előre (terv-3 69)
  const prefetch = usePrefetchOnHover(t);
  // videotéka-téma (D10): matrica, kategóriacímke, árcédula, videomagnó-felirat – csak ebben a témában
  const teka = useTheme() === 'teka';
  const category = teka && tekaCategory(t.genres);
  const osd = teka && tekaOsd(status);

  return (
    <article
      className="card"
      data-status={status}
      data-release={release ? release.kind : undefined}
      data-draining={draining ? '' : undefined}
      onPointerEnter={(e) => {
        setPointed(true);
        prefetch.onPointerEnter(e);
      }}
      onPointerLeave={prefetch.onPointerLeave}
      {...ambientProps(ambient)}
    >
      {/* a borítóra kattintva a szerkesztő ablak nyílik (mint a ceruzával; billentyűzettel és
          képernyőolvasóval a ceruza gomb ugyanez); sorozatnál a borító alján évadonként egy
          szakasz, egyébként egy állapotcsík */}
      <div className="poster" ref={posterRef} onClick={() => onEdit(t, posterRef.current)}>
        {t.poster_path ? (
          <>
            <img src={POSTER_BASE + t.poster_path} alt="" loading="lazy" />
            {draining && <img key={strike} className="drain-copy" src={POSTER_BASE + t.poster_path} alt="" />}
          </>
        ) : (
          <span className="poster-fallback">{t.title}</span>
        )}
        {/* jobb felső sarok: Mama „Érdekli” jelölése („M”, a többi Mama-érték a kártyán nem
            látszik – a szűrő mutatja) és a „Letöltve” jelvény */}
        {(mamaWants || downloaded) && (
          <span className="poster-corner">
            {mamaWants && (
              <span className="mama-mark" title="Mamát érdekli" role="img" aria-label="Mamát érdekli">
                M
              </span>
            )}
            {downloaded && downloadPhase !== 'wait' && (
              <span className="badge" data-new={downloadPhase === 'play' ? '' : undefined}>
                Letöltve
              </span>
            )}
          </span>
        )}
        {release && <ReleaseBadge state={release} />}
        {upcoming && <ReleaseBadge state={upcoming} />}
        {teka && (
          <span className="teka-marks" aria-hidden="true">
            {osd && <span className="teka-osd">{osd}</span>}
            {t.my_rating && <span className="teka-price">{t.my_rating}/10</span>}
            {category && (
              <span className="teka-cat" style={{ '--cat': category.color }}>
                {category.label}
              </span>
            )}
          </span>
        )}
        {seasons ? <SeasonStrip title={t} /> : <span className="status-strip" aria-hidden="true" />}
      </div>
      {teka && tekaIsNew(t) && (
        <span className="teka-new" aria-hidden="true">
          ÚJ!
        </span>
      )}

      <button
        type="button"
        className="edit-btn"
        aria-label={`${label} adatlapja`}
        onClick={() => onEdit(t, posterRef.current)}
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
      <h3 title={t.title}>
        <span key={strike} className="strike" data-strike={strike ? '' : undefined}>
          {link ? (
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${t.title} megnyitása: ${link.site}`}
            >
              <Hl text={t.title} />
            </a>
          ) : (
            <Hl text={t.title} />
          )}
        </span>
      </h3>
      {season > 0 && <p className="card-season">{season}. évad</p>}
      {t.original_title && t.original_title !== t.title && (
        <p className="original">
          <Hl text={t.original_title} />
        </p>
      )}
      {franchise && (
        <p className="card-franchise">
          Franchise: <Hl text={franchise} />
        </p>
      )}
      <p className="meta">
        {t.release_year && <span>{t.release_year}</span>}
        <span>{t.media_type === 'tv' ? 'Sorozat' : 'Film'}</span>
        <ImdbBadge title={t} />
        {status !== DEFAULT_STATUS && <span className="status-name">{item ? item.statusName : t.status_name}</span>}
        {seasons && !season && (
          <span>
            {seasons.watched}/{seasons.aired} évad
          </span>
        )}
      </p>
      {t.my_rating && (
        <p className="card-stars">
          <StarsDisplay value={t.my_rating} />
        </p>
      )}
      <GenreList className="genres" genres={t.genres} />
      <p className="added">
        Hozzáadva: <time dateTime={t.created_at}>{formatDate(t.created_at)}</time>
      </p>
    </article>
  );
}
