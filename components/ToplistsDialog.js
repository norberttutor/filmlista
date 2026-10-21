'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { apiGet } from '@/lib/api';
import { titleKey } from '@/lib/titles';
import { useBackdropClose } from '@/lib/useBackdropClose';
import { useSlidingThumb } from '@/lib/useSlidingThumb';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { useTheme } from '@/lib/theme';
import FranchiseFilter from '@/components/FranchiseFilter';
import GenreIcon from '@/components/GenreIcon';
import { ALL_GENRES_ICON, DECADE_ICON } from '@/components/FilterIcons';
import { CreditStatus, useAddCredit, asItem } from '@/components/PersonPage';
import DialogClose from '@/components/DialogClose';

const IMG = 'https://image.tmdb.org/t/p/';
// a /api/tmdb/toplist válaszának változata – a válasz (mezők, szűrés, rangsor) változásakor emeld
export const TOPLIST_V = 1;
const TOP = 100; // a toplista hossza (a szűrők után; Norbi döntése – a 250 talán később)
const PAGE = 25; // egyszerre ennyi sor, a „Továbbiak mutatása” ennyivel többet hoz
const SLOW_MS = 2500; // ennyi után szól, hogy az összeállítás eltarthat
const STORE_KEY = 'filmlista-toplista'; // az utoljára nézett típus és lista

const TYPES = [
  { id: 'movie', label: 'Filmek' },
  { id: 'tv', label: 'Sorozatok' },
];
const LISTS = [
  { id: 'all', label: 'Minden idők legjobbjai', short: 'Minden idők' },
  { id: 'recent', label: 'Az elmúlt 5 év legjobbjai', short: 'Elmúlt 5 év' },
  { id: 'gems', label: 'Rejtett gyöngyszemek', short: 'Gyöngyszemek' },
];

const PHONE_QUERY = '(max-width: 640px)';
const builtFormat = new Intl.DateTimeFormat('hu-HU', { month: 'short', day: 'numeric', timeZone: 'Europe/Budapest' });
const decimal = (n) => String(n).replace('.', ',');

// „3,2 millió”, „904 ezer”, „8,5 ezer”
function votesLabel(v) {
  if (v >= 1e6) return `${decimal((v / 1e6).toFixed(1))} millió`;
  if (v >= 1e4) return `${Math.round(v / 1000)} ezer`;
  return `${decimal((v / 1000).toFixed(1))} ezer`;
}

// az évtized neve: „2020-as évek”, „1990-es évek” (a toldalék a kiejtett számnévhez illeszkedik)
const DECADE_SUFFIX = { 0: 'es', 1: 'es', 2: 'as', 3: 'as', 4: 'es', 5: 'es', 6: 'as', 7: 'es', 8: 'as', 9: 'es' };
const decadeOf = (t) => (t.release_year ? String(Math.floor(t.release_year / 10) * 10) : '');
const decadeLabel = (d) => `${d}-${DECADE_SUFFIX[Number(d[2])]} évek`;

function listNote(type, list) {
  const what = type === 'movie' ? 'filmek' : 'sorozatok';
  if (list === 'recent') return `Az utóbbi öt évben (${new Date().getFullYear() - 5} óta) megjelent legjobb ${what}`;
  if (list === 'gems') return `Kevésbé ismert, de magasra értékelt ${what}: IMDb 7,5 fölött, 5 és 150 ezer közötti szavazattal`;
  return `A legjobb ${what} a súlyozott IMDb-értékelés szerint`;
}

function readStored() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    return {
      type: TYPES.some((t) => t.id === v?.type) ? v.type : 'movie',
      list: LISTS.some((l) => l.id === v?.list) ? v.list : 'all',
    };
  } catch {
    return { type: 'movie', list: 'all' };
  }
}

// Fülsor (Filmek | Sorozatok, és a listák): nyilakkal / Home / End lép, csúszó kijelölővel
function Tabs({ label, tabs, value, onChange, short }) {
  const thumb = useSlidingThumb();
  const refs = useRef({});
  function onKey(e) {
    const i = tabs.findIndex((t) => t.id === value);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    const next = tabs[(to + tabs.length) % tabs.length].id;
    onChange(next);
    refs.current[next]?.focus();
  }
  return (
    <div className={`dialog-tabs sliding${short ? ' toplist-lists' : ''}`} ref={thumb} role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={(el) => (refs.current[t.id] = el)}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          aria-controls="toplist-panel"
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={onKey}
        >
          {short ? (
            <>
              <span className="toplist-tab-full">{t.label}</span>
              <span className="toplist-tab-short" aria-hidden="true">
                {t.short}
              </span>
            </>
          ) : (
            t.label
          )}
        </button>
      ))}
    </div>
  );
}

// ⋮ „Toplisták” (terv-3 120, Norbi választása: „A” – rangsor; munka/terv-3/terv-120/): a legjobb filmek / sorozatok
// IMDb-értékelés szerint, csak a magyarul is megjelent címekből (a szerver dönti el – lib/server/toplists.js). Három
// lista (Minden idők, Az elmúlt 5 év, Rejtett gyöngyszemek), szűrők: Műfaj, Évtized (az 5 évesnél nincs), „A listámon
// lévők elrejtése”. Legfeljebb 100 cím (a szűrők után), 25-ösével. A listán lévő „✓ A listán” / „✓ Megnézve” (+ saját
// csillag), a többi „+ Hozzáadás” / „Már láttam”. A borító és a cím az adatlap-előnézetet nyitja (az ablak fölött).
// Videotéka-témában „A hét slágerei” (a CSS a :root[data-theme='teka'] előtaggal). Kikattintásra zár, kivéve ha épp
// cím kerül fel a listára. Net nélkül a menüpont nincs (Watchlist ONLINE_ONLY).
export default function ToplistsDialog({ titles, onClose, onPreview, onAdded, readOnly }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const teka = useTheme() === 'teka';
  const [{ type, list }, setView] = useState(readStored);
  const [genre, setGenre] = useState('');
  const [decade, setDecade] = useState('');
  // „A listámon lévők elrejtése”: a bekapcsoláskor listán lévők rejtve – a most felvett „✓ A listán”-nal a helyén marad
  const [hiddenKeys, setHiddenKeys] = useState(null);
  const [shown, setShown] = useState(PAGE);
  const [lists, setLists] = useState(new Map()); // `${type}:${list}` → { status, data, error, slow }
  const [attempt, setAttempt] = useState(0);
  const { adding, errors, add } = useAddCredit(onAdded);
  const closing = { onClose: () => dialogRef.current.close(), canClose: () => !adding };
  const backdrop = useBackdropClose(dialogRef, closing);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    headingRef.current?.focus();
  }, []);

  const key = `${type}:${list}`;
  const entry = lists.get(key);

  // a lista betöltése (egyszer; hibánál az „Újrapróbálás” újra)
  useEffect(() => {
    if (lists.get(key)?.status === 'done') return;
    const controller = new AbortController();
    setLists((m) => new Map(m).set(key, { status: 'loading' }));
    const slow = setTimeout(() => setLists((m) => (m.get(key)?.status === 'loading' ? new Map(m).set(key, { status: 'loading', slow: true }) : m)), SLOW_MS);
    apiGet('/api/tmdb/toplist', { type, list, v: TOPLIST_V }, { signal: controller.signal })
      .then((data) => setLists((m) => new Map(m).set(key, { status: 'done', data })))
      .catch((err) => err.name !== 'AbortError' && setLists((m) => new Map(m).set(key, { status: 'error', error: err.message })))
      .finally(() => clearTimeout(slow));
    return () => {
      clearTimeout(slow);
      controller.abort();
    };
    // a lists szándékosan nincs benne: csak a választás (és az „Újrapróbálás”) indít betöltést
  }, [key, attempt]);

  function choose(next) {
    setView((v) => {
      const view = { ...v, ...next };
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(view));
      } catch {
        // tárolás nélkül is működik
      }
      return view;
    });
    setShown(PAGE);
  }

  const rows = useMemo(() => new Map(titles.map((t) => [titleKey(t), t])), [titles]);
  const items = entry?.status === 'done' ? entry.data.items : [];
  const useDecade = list !== 'recent';

  // a szűrők választékai a többi szűrővel számolt darabszámokkal (mint a fő lista szűrősora)
  const genreNames = useMemo(() => [...new Set(items.flatMap((t) => t.genres))].sort((a, b) => a.localeCompare(b, 'hu')), [items]);
  const activeGenre = genreNames.includes(genre) ? genre : ''; // pl. a filmes műfaj a sorozatoknál nincs
  const decades = useMemo(() => [...new Set(items.map(decadeOf).filter(Boolean))].sort().reverse(), [items]);
  const activeDecade = useDecade && decades.includes(decade) ? decade : '';
  const byGenre = (t, g) => !g || t.genres.includes(g);
  const byDecade = (t, d) => !d || decadeOf(t) === d;
  const genreCount = (g) => items.filter((t) => byGenre(t, g) && byDecade(t, activeDecade)).length;
  const decadeCount = (d) => items.filter((t) => byGenre(t, activeGenre) && byDecade(t, d)).length;

  // a helyezés a műfaj / évtized szerinti szűrés utáni sorrend (a „legjobb krimik” is 1-től számol); az elrejtés nem számoz át
  const ranked = items.filter((t) => byGenre(t, activeGenre) && byDecade(t, activeDecade)).slice(0, TOP);
  const visible = ranked
    .map((t, i) => ({ t, rank: i + 1 }))
    .filter(({ t }) => !hiddenKeys?.has(titleKey(t)));
  const page = visible.slice(0, shown);
  const filtered = activeGenre || activeDecade;

  const filterLabel = (text, id) => isPhone && <span id={id}>{text}</span>;

  return (
    <dialog
      ref={dialogRef}
      className="editor stats-dialog toplist-dialog"
      aria-labelledby="toplist-title"
      onClose={(e) => e.target === e.currentTarget && onClose()}
      {...backdrop}
    >
      <DialogClose dialogRef={dialogRef} {...closing} />
      <div>
        <header className="stats-head">
          <h2 id="toplist-title" ref={headingRef} tabIndex={-1}>
            Toplisták
          </h2>
          <p>IMDb-értékelés szerint · csak magyarul megjelent címek</p>
        </header>
        {teka && (
          <p className="teka-chart" aria-hidden="true">
            ★ A hét slágerei ★
          </p>
        )}

        <div className="toplist-bar">
          <Tabs label="Típus" tabs={TYPES} value={type} onChange={(t) => choose({ type: t })} />
          <Tabs label="Lista" tabs={LISTS} value={list} onChange={(l) => choose({ list: l })} short />
        </div>

        <div className="toplist-filters">
          {genreNames.length > 0 && (
            <div className="inline-field">
              {filterLabel('Műfaj', 'toplist-genre-label')}
              <FranchiseFilter
                labelId={isPhone ? 'toplist-genre-label' : undefined}
                label={isPhone ? undefined : 'Műfaj'}
                className="genre-filter"
                lead="icon"
                layout={isPhone ? undefined : 'grid'}
                changed={!!activeGenre}
                icon={isPhone ? undefined : ALL_GENRES_ICON}
                value={activeGenre}
                onChange={(g) => {
                  setGenre(g);
                  setShown(PAGE);
                }}
                options={[
                  { value: '', label: 'Összes', icon: isPhone ? undefined : ALL_GENRES_ICON, count: isPhone ? undefined : genreCount('') },
                  ...genreNames.map((g) => ({ value: g, label: g, icon: <GenreIcon name={g} />, count: isPhone ? undefined : genreCount(g) })),
                ]}
              />
            </div>
          )}
          {useDecade && decades.length > 0 && (
            <div className="inline-field">
              {filterLabel('Évtized', 'toplist-decade-label')}
              <FranchiseFilter
                labelId={isPhone ? 'toplist-decade-label' : undefined}
                label={isPhone ? undefined : 'Évtized'}
                rootClass="filter-select"
                className="decade-filter"
                lead="icon"
                changed={!!activeDecade}
                icon={isPhone ? undefined : DECADE_ICON}
                value={activeDecade}
                onChange={(d) => {
                  setDecade(d);
                  setShown(PAGE);
                }}
                options={[
                  { value: '', label: 'Mind', icon: isPhone ? undefined : DECADE_ICON, count: isPhone ? undefined : decadeCount('') },
                  ...decades.map((d) => ({ value: d, label: decadeLabel(d), count: isPhone ? undefined : decadeCount(d) })),
                ]}
              />
            </div>
          )}
          <label className="check toplist-hide">
            <input
              type="checkbox"
              checked={!!hiddenKeys}
              onChange={(e) => setHiddenKeys(e.target.checked ? new Set(rows.keys()) : null)}
            />
            A listámon lévők elrejtése
          </label>
        </div>

        <div role="tabpanel" id="toplist-panel" aria-label={`${TYPES.find((t) => t.id === type).label} – ${LISTS.find((l) => l.id === list).label}`}>
          {(!entry || entry.status === 'loading') && (
            <>
              <p className="toplist-note" role="status">
                {entry?.slow ? 'A lista összeállítása… az első alkalommal fél percig is eltarthat.' : 'A lista betöltése…'}
              </p>
              <ul className="toplist-list" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className="toplist-row toplist-sk">
                    <span className="sk sk-line toplist-sk-rank" />
                    <span className="sk toplist-poster" />
                    <span className="toplist-text">
                      <span className="sk sk-line sk-w80" />
                      <span className="sk sk-line toplist-sk-meta" />
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {entry?.status === 'error' && (
            <div className="toplist-error">
              <p className="error small" role="alert">
                {entry.error}
              </p>
              <button type="button" className="ghost mini" onClick={() => setAttempt((n) => n + 1)}>
                Újrapróbálás
              </button>
            </div>
          )}

          {entry?.status === 'done' && (
            <>
              <p className="toplist-note">
                {listNote(type, list)}
                {entry.data.built_at && ` · frissítve: ${builtFormat.format(new Date(entry.data.built_at))}`}
              </p>
              {!entry.data.complete && (
                <p className="toplist-note">
                  Néhány cím IMDb-értékelése még hiányzik (az OMDb napi kerete elfogyott) – holnapra teljes lesz a lista.
                </p>
              )}
              {page.length === 0 ? (
                <div className="toplist-empty">
                  <p className="muted">
                    {items.length === 0
                      ? 'A toplista most üres. Próbáld újra később.'
                      : ranked.length === 0
                        ? 'Ezekkel a szűrőkkel nincs cím a toplistán.'
                        : 'A toplista minden címe a listádon van.'}
                  </p>
                  {filtered && ranked.length === 0 && (
                    <button
                      type="button"
                      className="ghost mini"
                      onClick={() => {
                        setGenre('');
                        setDecade('');
                      }}
                    >
                      Szűrők törlése
                    </button>
                  )}
                </div>
              ) : (
                <ol className="toplist-list">
                  {page.map(({ t, rank }) => {
                    const k = titleKey(t);
                    const row = rows.get(k);
                    const preview = () => onPreview(asItem(t));
                    return (
                      <li key={k} value={rank} className="toplist-row" data-status={row?.status}>
                        <span className="toplist-rank" aria-hidden="true">
                          {rank}
                        </span>
                        <button type="button" className="toplist-poster" aria-label={`${t.title} adatlapja`} onClick={preview}>
                          {t.poster_path && <img src={`${IMG}w185${t.poster_path}`} alt="" loading="lazy" />}
                        </button>
                        <span className="toplist-text">
                          <button type="button" className="toplist-title" title={t.title} onClick={preview}>
                            {t.title}
                            {t.release_year && <span className="toplist-year"> ({t.release_year})</span>}
                          </button>
                          <span className="toplist-meta">
                            <span className="imdb">
                              IMDb <b>{decimal(t.imdb_rating)}</b>
                            </span>{' '}
                            · {votesLabel(t.imdb_votes)} szavazat
                          </span>
                          {t.genres.length > 0 && <span className="toplist-meta">{t.genres.slice(0, 3).join(' · ')}</span>}
                          {errors[k] && <span className="error small">{errors[k]}</span>}
                        </span>
                        <span className="toplist-side">
                          <CreditStatus c={t} row={row} adding={adding} add={add} readOnly={readOnly} />
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
              {visible.length > shown && (
                <button type="button" className="ghost toplist-more" onClick={() => setShown((n) => n + PAGE)}>
                  Továbbiak mutatása
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
