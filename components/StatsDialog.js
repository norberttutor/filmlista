'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { listStats, formatDecimal, formatSigned, TASTE_MIN } from '@/lib/stats';
import { genreColor } from '@/lib/genreColors';
import { useBackdropClose } from '@/lib/useBackdropClose';
import { usePosterColor, franchisePosterPath } from '@/lib/posterColor';

const THUMB_BASE = 'https://image.tmdb.org/t/p/w154';
const TOP_GENRES = 7;
const TOP_FRANCHISES = 5;
const TOP_SERIES = 8;

// Havonta megnézett címek oszlopdiagramja (saját SVG; egy lépték a magassághoz); az utolsó oszlop
// (a mostani hónap) teljes erővel, a korábbiak halványabban (terv-3 51.9)
function MonthChart({ months }) {
  const W = 560;
  const H = 150;
  const slot = W / months.length;
  const max = Math.max(1, ...months.map((m) => m.count));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Havonta megnézett címek: ${months.map((m) => `${m.label} ${m.count}`).join(', ')}`}>
      {months.map((m, i) => {
        const h = (m.count / max) * (H - 36);
        const x = i * slot + 6;
        const w = slot - 12;
        return (
          <g key={m.key}>
            <rect className={!m.count ? 'bar empty' : i === months.length - 1 ? 'bar current' : 'bar'} x={x} y={H - 20 - Math.max(h, 2)} width={w} height={Math.max(h, 2)} rx="4" />
            {m.count > 0 && (
              <text className="value" x={x + w / 2} y={H - 26 - h} textAnchor="middle">
                {m.count}
              </text>
            )}
            <text className="month" x={x + w / 2} y={H - 4} textAnchor="middle">
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// A franchise sávja a franchise saját színében (terv-3 51.9): ugyanabból a borítóból, mint a
// Franchise-ok csempéje (franchisePosterPath); amíg nincs kiszámolva, a megszokott türkiz
function FranchiseBar({ name, n, max, posterPath }) {
  const color = usePosterColor(posterPath);
  return (
    <li style={color ? { '--fr': color } : undefined}>
      <span title={name}>{name}</span>
      <span className="meter" aria-hidden="true">
        <i style={{ width: `${(n / max) * 100}%` }} />
      </span>
      <b>{n}</b>
    </li>
  );
}

// Statisztika: széles ablak csempékkel, a betöltött listából számolva (lib/stats.js)
export default function StatsDialog({ titles, franchiseName, onClose }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const s = useMemo(() => listStats(titles, franchiseName), [titles, franchiseName]);
  // asztalon kikattintásra bezárul (nincs benne bevitel, mindig zárhat)
  const backdrop = useBackdropClose(dialogRef, { onClose: () => dialogRef.current.close() });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
  }, []);

  const shownGenres = s.genres.slice(0, TOP_GENRES);
  const otherGenres = s.genres.slice(TOP_GENRES).reduce((sum, [, n]) => sum + n, 0);
  const frMax = Math.max(1, ...s.franchises.map(([, n]) => n));
  // franchise neve → azonosító (a nevek felhasználónként egyediek), a sáv színéhez
  const franchiseId = useMemo(() => new Map([...franchiseName].map(([id, name]) => [name, id])), [franchiseName]);
  const diff = s.ratings.mine != null && s.ratings.imdb != null ? s.ratings.mine - s.ratings.imdb : null;
  // ízlésprofil: az eltérés-sávok léptéke (legalább 1 pont, hogy a kis eltérés kicsinek látsszon)
  const devMax = Math.max(1, ...[...s.taste.above, ...s.taste.below].map((d) => Math.abs(d.diff)));

  return (
    <dialog ref={dialogRef} className="editor stats-dialog" aria-labelledby="stats-title" onClose={onClose} {...backdrop}>
      <div>
        <header className="stats-head">
          <h2 id="stats-title" ref={headingRef} tabIndex={-1}>
            Statisztika
          </h2>
          <p>A teljes lista alapján · {s.counts.total} cím</p>
          <button type="button" className="ghost" onClick={() => dialogRef.current.close()}>
            Bezárás
          </button>
        </header>

        <div className="bento">
          <section className="tile tile-2" data-tile="watched" aria-labelledby="st-year">
            <h3 id="st-year">Megnézve az utolsó 12 hónapban</h3>
            <p className="big watched">{s.watchedLastYear}</p>
            <p className="sub">
              átlagosan {formatDecimal(s.watchedLastYear / 12)} havonta · összesen {s.counts.watched} megnézett cím
            </p>
          </section>

          <section className="tile tile-4" data-tile="months" aria-labelledby="st-months">
            <h3 id="st-months">Havonta megnézett címek</h3>
            <MonthChart months={s.months} />
          </section>

          <section className="tile tile-3" data-tile="genres" aria-labelledby="st-genres">
            <h3 id="st-genres">Műfajok a listán</h3>
            {shownGenres.length ? (
              <>
                <div className="genre-band" aria-hidden="true">
                  {shownGenres.map(([g, n]) => (
                    <span key={g} style={{ flex: n, '--genre': genreColor(g) }} />
                  ))}
                  {otherGenres > 0 && <span style={{ flex: otherGenres }} />}
                </div>
                <ul className="genre-legend">
                  {shownGenres.map(([g, n]) => (
                    <li key={g} className="genre" style={{ '--genre': genreColor(g) }}>
                      {g}
                      <b>{n}</b>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="sub">Még nincs műfaj a listán.</p>
            )}
          </section>

          <section className="tile tile-3" data-tile="ratings" aria-labelledby="st-ratings">
            <h3 id="st-ratings">Értékelések</h3>
            <div className="rating-pair">
              <p>
                <span className="big mine">{formatDecimal(s.ratings.mine)}</span>
                <span className="sub">saját átlag · {s.ratings.mineCount} cím</span>
              </p>
              <p>
                <span className="big">{formatDecimal(s.ratings.imdb)}</span>
                <span className="sub">IMDb-átlag · {s.ratings.imdbCount} cím</span>
              </p>
            </div>
            {diff != null && Math.abs(diff) >= 0.05 && (
              <p className="sub">
                Átlagosan {formatDecimal(Math.abs(diff))} ponttal értékelsz {diff > 0 ? 'magasabbra' : 'alacsonyabbra'}, mint az IMDb.
              </p>
            )}
          </section>

          {/* ízlésprofil (terv-3 42, 2026-10-07): a saját csillagok műfajonként */}
          <section className="tile tile-3" data-tile="favorites" aria-labelledby="st-favorites">
            <h3 id="st-favorites">Kedvenc műfajaid</h3>
            {s.taste.favorites.length ? (
              <ul className="tile-bars taste">
                {s.taste.favorites.map((x) => (
                  <li key={x.genre}>
                    <span className="genre" style={{ '--genre': genreColor(x.genre) }} title={x.genre}>
                      {x.genre}
                    </span>
                    <span className="meter" aria-hidden="true">
                      <i style={{ width: `${x.average * 10}%` }} />
                    </span>
                    <b aria-label={`átlag ${formatDecimal(x.average)}, ${x.count} cím`}>
                      {formatDecimal(x.average)}
                      <small> · {x.count}</small>
                    </b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sub">Egy műfajhoz legalább {TASTE_MIN} saját értékelés kell – még egyiknél sincs meg.</p>
            )}
            {s.taste.favorites.length > 0 && <p className="sub">A saját csillagaid átlaga műfajonként (· értékelt címek).</p>}
          </section>

          <section className="tile tile-3" data-tile="deviation" aria-labelledby="st-deviation">
            <h3 id="st-deviation">Te és az IMDb műfajonként</h3>
            {s.taste.above.length || s.taste.below.length ? (
              <>
                {[
                  ['Jobban tetszik neked', s.taste.above, 'up'],
                  ['Szigorúbb vagy', s.taste.below, 'down'],
                ].map(
                  ([label, list, dir]) =>
                    list.length > 0 && (
                      <div key={dir} className="deviation">
                        <p className="sub">{label}</p>
                        <ul className={`tile-bars deviation-${dir}`}>
                          {list.map((x) => (
                            <li key={x.genre}>
                              <span className="genre" style={{ '--genre': genreColor(x.genre) }} title={x.genre}>
                                {x.genre}
                              </span>
                              <span className="meter" aria-hidden="true">
                                <i style={{ width: `${(Math.abs(x.diff) / devMax) * 100}%` }} />
                              </span>
                              <b aria-label={`${formatSigned(x.diff)} pont az IMDb-hez képest, ${x.count} cím`}>
                                {formatSigned(x.diff)}
                              </b>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                )}
              </>
            ) : (
              <p className="sub">
                Egy műfajhoz legalább {TASTE_MIN} cím kell saját és IMDb-értékeléssel is – még egyiknél sincs meg (vagy
                mindenhol egyetértesz az IMDb-vel).
              </p>
            )}
          </section>

          <section className="tile tile-2" data-tile="backlog" aria-labelledby="st-backlog">
            <h3 id="st-backlog">Letöltve, még nem láttad</h3>
            <p className="big">{s.backlog.length}</p>
            {s.backlog.length > 0 && (
              <div className="backlog-posters">
                {s.backlog
                  .filter((t) => t.poster_path)
                  .slice(0, 6)
                  .map((t) => (
                    <img key={t.id} src={THUMB_BASE + t.poster_path} alt={t.title} title={t.title} loading="lazy" />
                  ))}
              </div>
            )}
          </section>

          <section className="tile tile-2" data-tile="franchise" aria-labelledby="st-franchise">
            <h3 id="st-franchise">Legtöbb cím franchise-onként</h3>
            {s.franchises.length ? (
              <ul className="tile-bars">
                {s.franchises.slice(0, TOP_FRANCHISES).map(([name, n]) => (
                  <FranchiseBar key={name} name={name} n={n} max={frMax} posterPath={franchisePosterPath(franchiseId.get(name), titles)} />
                ))}
              </ul>
            ) : (
              <p className="sub">Még nincs franchise a listán.</p>
            )}
          </section>

          <section className="tile tile-2" data-tile="series" aria-labelledby="st-series">
            <h3 id="st-series">Folyamatban lévő sorozatok</h3>
            {s.series.length ? (
              <ul className="tile-bars series">
                {s.series.slice(0, TOP_SERIES).map((x) => (
                  <li key={x.id}>
                    <span title={x.title}>{x.title}</span>
                    <span className="meter" aria-hidden="true">
                      <i style={{ width: `${(x.watched / x.aired) * 100}%` }} />
                      <i className="watching" style={{ width: `${(x.watching / x.aired) * 100}%` }} />
                    </span>
                    <b aria-label={`${x.watched} / ${x.aired} évad megnézve`}>
                      {x.watched}/{x.aired}
                    </b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sub">Most nincs folyamatban lévő sorozat.</p>
            )}
          </section>
        </div>
      </div>
    </dialog>
  );
}
