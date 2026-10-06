'use client';

import { useRef, useState } from 'react';
import {
  updateTitle,
  externalLink,
  formatDate,
  releaseState,
  todayDate,
  DEFAULT_STATUS,
  DROPPED_STATUS,
  MAMA_OPTIONS,
} from '@/lib/titles';
import StarRating from '@/components/StarRating';
import FranchiseSelect from '@/components/FranchiseSelect';
import ImdbBadge from '@/components/ImdbBadge';
import GenreList from '@/components/GenreList';
import ReleaseBadge from '@/components/ReleaseBadge';
import { hasSeasons, SeasonCell, SeasonDownloads } from '@/components/Seasons';
import { useStrike } from '@/lib/useStrike';
import { usePosterColor, ambientProps } from '@/lib/posterColor';

const THUMB_BASE = 'https://image.tmdb.org/t/p/w154';

// Asztali nézet: egy cím soronként, a saját adatok közvetlenül a sorban szerkeszthetők.
// entries: { key, title, item } – az item a nézési sorrend tétele (a fő lista „Nézési sorrend”
// rendezésében: évadnál „2. évad”, az állapot az évadé), egyébként null
export default function TitleTable({
  entries,
  statuses,
  franchises,
  onCreateFranchise,
  onDeleteFranchise,
  onRenameFranchise,
  onEdit,
  onUpdated,
  onDelete,
}) {
  return (
    <div className="table-wrap">
      <table className="titles-table">
        <thead>
          <tr>
            <th scope="col">Cím</th>
            <th scope="col" className="col-check">
              Letöltve
            </th>
            <th scope="col" className="col-status">
              Állapot
            </th>
            <th scope="col" className="col-mama">
              Mama
            </th>
            <th scope="col" className="col-rating">
              Értékelés
            </th>
            <th scope="col" className="col-actions">
              <span className="sr-only">Törlés</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <TitleRow
              key={e.key}
              title={e.title}
              item={e.item}
              statuses={statuses}
              franchises={franchises}
              onCreateFranchise={onCreateFranchise}
              onDeleteFranchise={onDeleteFranchise}
              onRenameFranchise={onRenameFranchise}
              onEdit={onEdit}
              onUpdated={onUpdated}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TitleRow({
  title: t,
  item,
  statuses,
  franchises,
  onCreateFranchise,
  onDeleteFranchise,
  onRenameFranchise,
  onEdit,
  onUpdated,
  onDelete,
}) {
  const [saveState, setSaveState] = useState(''); // '' | 'saving' | 'saved'
  const [error, setError] = useState('');
  const savedTimer = useRef(null);
  const link = externalLink(t);
  // a borító hangulatszíne: az első rámutatáskor / fókusznál számolódik, a sor halványan felveszi
  const [pointed, setPointed] = useState(false);
  const ambient = usePosterColor(t.poster_path, pointed);
  // még meg nem jelent film: szaggatott keret a borító körül és dátumos jelvény
  const release = releaseState(t);
  const strike = useStrike(item ? item.status : t.status); // megnézettre váltáskor kihúzás a címen

  // Mentés azonnal: a sor rögtön az új értéket mutatja, hiba esetén visszaáll.
  async function save(changes) {
    const before = t;
    const status = changes.status ?? t.status;
    onUpdated({
      ...t,
      ...changes,
      status_name: statuses.find((s) => s.code === status)?.name ?? t.status_name,
    });
    setError('');
    setSaveState('saving');
    clearTimeout(savedTimer.current);
    try {
      onUpdated(await updateTitle(t.id, changes));
      setSaveState('saved');
      savedTimer.current = setTimeout(() => setSaveState(''), 2000);
    } catch (err) {
      onUpdated(before);
      setSaveState('');
      setError(err.message);
    }
  }

  function changeStatus(code) {
    const becomesWatched = code === 'watched' && t.status !== 'watched';
    save({
      status: code,
      // ugyanúgy, mint a szerkesztő ablakban: megnézettnél a mai nap, ha még nincs dátum
      watched_at: code === 'watched' ? t.watched_at ?? todayDate() : null,
      // megnézettre állításkor a "Letöltve" törlődik (az adatbázis-trigger is ezt teszi,
      // itt azért küldjük, hogy a pipa azonnal eltűnjön)
      ...(becomesWatched && { is_downloaded: false }),
    });
  }

  return (
    <tr
      data-status={item ? item.status : t.status}
      data-release={release ? release.kind : undefined}
      onPointerEnter={() => setPointed(true)}
      onFocus={() => setPointed(true)}
      {...ambientProps(ambient)}
    >
      <td className="cell-title">
        <div className="row-title">
          {/* a borítóra kattintva a szerkesztő ablak (részletek, hasonló címek) – mint a kártyán */}
          <button
            type="button"
            className="thumb thumb-btn"
            aria-label={`Részletek és hasonló címek: ${t.title}`}
            title="Részletek és hasonló címek"
            onClick={(e) => onEdit(t, e.currentTarget)}
          >
            {t.poster_path && <img src={THUMB_BASE + t.poster_path} alt="" loading="lazy" />}
          </button>
          <div className="row-text">
            {/* mindig egy sorban; ha így sem fér ki, "…" és rámutatva a teljes cím */}
            <p className="row-name" title={t.title}>
              <span key={strike} className="strike" data-strike={strike ? '' : undefined}>
                {link ? (
                  <a href={link.href} target="_blank" rel="noopener noreferrer">
                    {t.title}
                  </a>
                ) : (
                  t.title
                )}
              </span>
            </p>
            {t.original_title && t.original_title !== t.title && (
              <p className="original">{t.original_title}</p>
            )}
            <p className="meta">
              {item?.season > 0 && <span className="season-tag">{item.season}. évad</span>}
              {t.release_year && <span>{t.release_year}</span>}
              <span>{t.media_type === 'tv' ? 'Sorozat' : 'Film'}</span>
              <ImdbBadge title={t} />
              {release && <ReleaseBadge state={release} />}
            </p>
            <GenreList className="row-genres" genres={t.genres} />
            <p className="added">
              Hozzáadva: <time dateTime={t.created_at}>{formatDate(t.created_at)}</time>
            </p>
            {error && (
              <p className="error small" role="alert">
                {error}
              </p>
            )}
          </div>
          {/* saját, fix szélességű oszlop a cím és a leírás között, középre igazítva – így
              a sorok nem ugrálnak; üresen csak rámutatáskor látszik, de a helyét megtartja */}
          <div className={t.franchise_id ? 'franchise-field' : 'franchise-field empty'}>
            {!t.franchise_id && <span aria-hidden="true">Franchise</span>}
            <FranchiseSelect
              className="franchise-select"
              label={`Franchise – ${t.title}`}
              value={t.franchise_id}
              franchises={franchises}
              onChange={(id) => save({ franchise_id: id })}
              onCreate={onCreateFranchise}
              onDelete={onDeleteFranchise}
              onRename={onRenameFranchise}
            />
          </div>
          {/* leírás: széles képernyőn a cím mellett, keskenyebben alatta (CSS); a teljes
              szöveg rámutatáskor látszik */}
          {t.overview && (
            <p className="row-overview" title={t.overview}>
              {t.overview}
            </p>
          )}
        </div>
      </td>

      {/* sorozatnál évadonként: a letöltött évadok és az évadcsík (az állapot ebből
          számolódik); évadok nélkül marad a kézi pipa és lenyíló */}
      <td className="col-check">
        {hasSeasons(t) ? (
          <SeasonDownloads title={t} />
        ) : (
          <input
            type="checkbox"
            aria-label={`Letöltve – ${t.title}`}
            checked={t.is_downloaded}
            onChange={(e) => save({ is_downloaded: e.target.checked })}
          />
        )}
      </td>
      <td className="col-status">
        {hasSeasons(t) ? (
          <SeasonCell title={t} onUpdated={onUpdated} onError={setError} />
        ) : (
          <select
            aria-label={`Állapot – ${t.title}`}
            value={t.status}
            onChange={(e) => changeStatus(e.target.value)}
          >
            {/* az "Abbahagyva" csak sorozatnál */}
            {statuses
              .filter((s) => s.code !== DROPPED_STATUS || t.media_type === 'tv' || t.status === s.code)
              .map((s) => (
                <option key={s.code} value={s.code}>
                  {/* az alapállapot üresen jelenik meg */}
                  {s.code === DEFAULT_STATUS ? '' : s.name}
                </option>
              ))}
          </select>
        )}
      </td>
      <td className="col-mama">
        <select
          aria-label={`Mama – ${t.title}`}
          className={t.mama_status ? 'mama-set' : undefined}
          value={t.mama_status ?? ''}
          onChange={(e) => save({ mama_status: e.target.value || null })}
        >
          <option value=""></option>
          {MAMA_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </select>
      </td>
      <td className="col-rating">
        <div className="rating-field">
          <StarRating
            name={`rating-${t.id}`}
            label={`Értékelés – ${t.title}`}
            value={t.my_rating}
            onChange={(n) => save({ my_rating: n })}
          />
          <span className="rating-number">{t.my_rating ? `${t.my_rating}/10` : ''}</span>
        </div>
      </td>
      <td className="col-actions">
        {/* a mentés állapota képernyőolvasónak (a változás a vezérlőkön látszik) */}
        <p className="save-state sr-only" aria-live="polite">
          {saveState === 'saving' ? 'Mentés…' : saveState === 'saved' ? 'Mentve' : ''}
        </p>
        {/* azonnal lekerül; 8 mp-ig visszavonható (a sávban) */}
        <button
          type="button"
          className="icon-btn"
          aria-label={`Törlés – ${t.title}`}
          title="Törlés (8 mp-ig visszavonható)"
          onClick={() => onDelete(t)}
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
