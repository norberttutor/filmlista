'use client';

// A fő lista szűrősora (components/Watchlist.js): típus, állapot, letöltés, műfaj, Mama, franchise, alaphelyzet,
// keresés, rendezés, lista / rács váltó; telefonon összecsukva. Az állapot és a logika: useListFilters.js.
import { Fragment, useState } from 'react';
import ProgressiveBlur from '@/components/ProgressiveBlur';
import FranchiseFilter from '@/components/FranchiseFilter';
import GenreIcon from '@/components/GenreIcon';
import {
  ALL_GENRES_ICON,
  DOWNLOAD_ICONS,
  FRANCHISE_ICON,
  MAMA_ICON,
  MamaDot,
  SORT_ICONS,
  STATUS_ICONS,
  TYPE_ICONS,
} from '@/components/FilterIcons';
import { MAMA_OPTIONS } from '@/lib/titles';
import { useSlidingThumb } from '@/lib/useSlidingThumb';
import { useScrollFade } from '@/lib/useScrollFade';
import { DEFAULT_FILTERS, DOWNLOAD_FILTERS, NO_FRANCHISE } from '@/components/list/listFilters';

function Chip({ active, onClick, label, count, icon, className }) {
  return (
    <button type="button" className={className ? `chip ${className}` : 'chip'} aria-pressed={active} onClick={onClick}>
      {icon}
      {label}
      {count !== undefined && <span className="n">{count}</span>}
    </button>
  );
}

// f: useListFilters(); sectionRef: a sáv (useCollapsingHeader); stuck: letapadva; stuckTools: a letapadt sáv
// gyorsgombjai (a „↑” után); view / changeView: asztalon (isDesktop) a lista / rács váltó
export default function FilterBar({ f, isPhone, isDesktop, view, changeView, sectionRef, stuck, stuckTools }) {
  const [filtersOpen, setFiltersOpen] = useState(false); // telefonon alapból összecsukva
  // csúszó kijelölő az állapotgombokon és a lista / rács váltón (terv-3 100)
  const statusThumb = useSlidingThumb();
  const viewThumb = useSlidingThumb();
  const downloadThumb = useSlidingThumb(); // asztalon a Letöltés is gombcsoport (M3)
  const chipsFade = useScrollFade(); // telefonon a szűrőcímkék sorának halványuló széle (átnézés J14)

  return (
    <section
      className={filtersOpen ? 'filters open' : 'filters'}
      aria-label="Szűrők"
      ref={sectionRef}
      data-stuck={stuck ? '' : undefined}
    >
      {/* letapadva a sáv alatt fokozatos elmosás (terv-3 102) */}
      {stuck && <ProgressiveBlur edge="top" />}
      {/* telefonon a szűrők alapból összecsukva: a gomb röviden mutatja a beállítást,
          kinyitva minden szűrő és a rendezés látszik (a kereső mindig) */}
      <button
        type="button"
        className="filters-toggle"
        aria-expanded={filtersOpen}
        onClick={() => setFiltersOpen((o) => !o)}
      >
        <b>Szűrők</b>
        <span className="filters-summary">{f.filterSummary}</span>
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      {/* telefonon, összecsukva: a beállított szűrők címkeként, ×-szel (terv-3 101); asztalon rejtve */}
      <div className="active-filters" role="group" aria-label="Beállított szűrők" ref={chipsFade}>
        {f.activeFilters.map((x) =>
          x.clear ? (
            <span key={x.key} className="active-filter">
              {x.label}
              <button type="button" aria-label={`„${x.label}” szűrő levétele`} title="Szűrő levétele" onClick={x.clear}>
                <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
                  <path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          ) : (
            <span key={x.key} className="active-filter fixed">
              {x.label}
            </span>
          )
        )}
        {!f.atDefault && (
          <button type="button" className="active-reset" onClick={f.resetToDefault}>
            ↺ Alaphelyzet
          </button>
        )}
      </div>

      {/* asztalon a lenyílók saját panellel nyílnak (M3); telefonon a beépített lenyíló marad */}
      {isPhone ? (
        <select
          className="type-select"
          aria-label="Típus"
          value={f.type}
          onChange={(e) => f.changeType(e.target.value)}
        >
          {f.typeOptions.map((t) => (
            <option key={t.code} value={t.code}>
              {t.name}
            </option>
          ))}
        </select>
      ) : (
        <FranchiseFilter
          rootClass="filter-select"
          className="type-filter"
          ariaLabel="Típus"
          lead="icon"
          value={f.type}
          onChange={f.changeType}
          options={f.typeOptions.map((t) => ({ value: t.code, label: t.name, icon: TYPE_ICONS[t.code] }))}
        />
      )}

      {/* mobilon az állapotgombok helyett lenyíló (CSS kapcsolja), a típus mellett */}
      <select
        className="status-select"
        aria-label="Állapot"
        value={f.status}
        onChange={(e) => f.pickStatus(e.target.value)}
      >
        <option value="all">Minden állapot ({f.allCount})</option>
        {f.shownStatuses.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name} ({f.countByStatus[s.code] ?? 0})
          </option>
        ))}
      </select>

      <div className="filter-group">
        {/* állapot (M3): a „Mind” külön, utána az állapotok egy közös sávban, ikonnal és darabszámmal; a
            csúszó kijelölő a sávon (a „Mind”-nek saját kiemelése van) */}
        <div className="chips status-chips" role="group" aria-label="Állapot">
          <Chip
            className="status-all"
            active={f.status === 'all'}
            onClick={() => f.pickStatus('all')}
            label="Mind"
            count={f.allCount}
          />
          <span className="status-sep" aria-hidden="true" />
          <span className="status-track sliding" ref={statusThumb}>
            {f.shownStatuses.map((s) => (
              <Chip
                key={s.code}
                active={f.status === s.code}
                onClick={() => f.pickStatus(s.code)}
                icon={STATUS_ICONS[s.code]}
                label={s.name}
                count={f.countByStatus[s.code] ?? 0}
              />
            ))}
          </span>
        </div>

        {isPhone ? (
          <label className="inline-field">
            Letöltés
            <select className="download-select" value={f.downloaded} onChange={(e) => f.setDownloaded(e.target.value)}>
              {DOWNLOAD_FILTERS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          // asztalon gombcsoport (M3, Norbi kérése: egy kattintással váltható)
          <div className="download-seg sliding" ref={downloadThumb} role="group" aria-label="Letöltés">
            {DOWNLOAD_FILTERS.map((d) => (
              <button
                key={d.code}
                type="button"
                aria-pressed={f.downloaded === d.code}
                onClick={() => f.setDownloaded(d.code)}
              >
                {DOWNLOAD_ICONS[d.code]}
                {d.code === 'all' ? 'Mind' : d.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {f.genres.length > 0 && (
        // saját lenyíló műfajikonokkal (terv-3 56, Norbi választása: „A”), a franchise-szűrő mintájára
        // asztalon (M3) a felirat a gombon belül, a panel rácsos, darabszámokkal (a 0 darabos halvány)
        <div className="inline-field">
          {isPhone && <span id="genre-filter-label">Műfaj</span>}
          <FranchiseFilter
            labelId={isPhone ? 'genre-filter-label' : undefined}
            label={isPhone ? undefined : 'Műfaj'}
            className="genre-filter"
            lead="icon"
            layout={isPhone ? undefined : 'grid'}
            changed={!!f.genre}
            icon={isPhone ? undefined : ALL_GENRES_ICON}
            value={f.genre}
            onChange={f.setGenre}
            options={[
              {
                value: '',
                label: 'Összes',
                icon: isPhone ? undefined : ALL_GENRES_ICON,
                count: isPhone ? undefined : f.facetCounts.genre.all,
              },
              ...f.genres.map((g) => ({
                value: g,
                label: g,
                icon: <GenreIcon name={g} />,
                count: isPhone ? undefined : (f.facetCounts.genre[g] ?? 0),
              })),
            ]}
          />
        </div>
      )}

      {/* csak ha van a listán Mama-jelölés, és nem Sorozatok / franchise-ra szűrve (terv-3 58) */}
      {(f.mamaUsed || f.mama) && !f.mamaOff &&
        (isPhone ? (
          <label className="inline-field">
            Mama
            <select className="mama-select" value={f.mama} onChange={(e) => f.setMama(e.target.value)}>
              <option value="">Összes</option>
              {MAMA_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <FranchiseFilter
            rootClass="filter-select"
            className="mama-filter"
            label="Mama"
            lead="icon"
            changed={!!f.mama}
            value={f.mama}
            onChange={f.setMama}
            options={[
              { value: '', label: 'Összes', icon: MAMA_ICON, count: f.facetCounts.mama.all },
              ...MAMA_OPTIONS.map((o) => ({
                value: o.code,
                label: o.name,
                icon: <MamaDot code={o.code} />,
                count: f.facetCounts.mama[o.code] ?? 0,
              })),
            ]}
          />
        ))}

      {/* a Franchise és mellette az alaphelyzet gomb együtt törik új sorba */}
      <div className="filter-end">
        {f.usedFranchises.length > 0 && (
          <div className="inline-field">
            {isPhone && <span id="franchise-filter-label">Franchise</span>}
            <FranchiseFilter
              labelId={isPhone ? 'franchise-filter-label' : undefined}
              label={isPhone ? undefined : 'Franchise'}
              changed={f.franchise !== DEFAULT_FILTERS.franchise}
              icon={isPhone ? undefined : FRANCHISE_ICON}
              value={f.franchise}
              onChange={f.changeFranchise}
              options={[
                { value: '', label: 'Összes' },
                { value: NO_FRANCHISE, label: 'Franchise nélkül' },
                ...f.franchiseOptions,
              ]}
            />
          </div>
        )}

        {/* alaphelyzet gomb: felirat nélkül, rámutatva súgó; alapállapotban halvány */}
        <span className="has-hint filter-reset-wrap">
          <button
            type="button"
            className="filter-reset"
            aria-label="Szűrők alaphelyzetbe"
            aria-describedby="filter-reset-hint"
            disabled={f.atDefault}
            onClick={f.resetToDefault}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <span id="filter-reset-hint" role="tooltip" className="hint">
            {f.atDefault ? 'A szűrők alaphelyzetben: ' : 'Szűrők alaphelyzetbe: '}
            Filmek · Megnézendő · Nem letöltött · Összes műfaj · Franchise nélkül
          </span>
        </span>

        {/* letapadt szűrősorban (lejjebb görgetve) gyorsgombok – csak asztalon (≥ 641 px): vissza a lap tetejére,
            és mert a fejléc sávja ilyenkor felgördül („A – Egy sáv”, Norbi választása, 2026-10-16), a fejléc
            gyakori gombjai (stuckTools): „+” (Cím hozzáadása), harang, ⋮. A helyük nyugalomban is foglalt, csak
            láthatatlan (data-off): letapadáskor a sor nem törhet másként, különben a sáv magassága – és vele a
            lista – megugrana */}
        <span className="stuck-tools" data-off={stuck ? undefined : ''}>
          <button
            type="button"
            className="ghost"
            aria-label="Vissza a lap tetejére"
            title="Vissza a lap tetejére"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
          {/* visszagörgetéskor (a sáv elenged) újraépül: a nyitva hagyott harang / ⋮ menü bezárul – különben
              láthatatlanul nyitva maradna, és a következő Vissza azt zárná */}
          <Fragment key={stuck ? 'on' : 'off'}>{stuckTools}</Fragment>
        </span>
      </div>

      {/* jobb szélen: keresés a felvett címek között, mellette a rendezés */}
      <div className="list-tools">
        <input
          type="search"
          className="list-search"
          aria-label="Keresés a listán"
          placeholder="Keresés a listán"
          value={f.searchInput}
          // amire a lista épp szűr (a mezőt átmenetben követi – terv-3 131, P3); a tesztek erre várnak
          data-searched={f.query}
          onChange={(e) => f.changeQuery(e.target.value)}
        />
        {isPhone ? (
          <select
            className="sort-select"
            aria-label="Rendezés"
            value={f.activeSort}
            onChange={(e) => f.changeSort(e.target.value)}
          >
            {f.sortOptions.map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <FranchiseFilter
            rootClass="filter-select"
            className="sort-filter"
            ariaLabel="Rendezés"
            lead="icon"
            value={f.activeSort}
            onChange={f.changeSort}
            options={f.sortOptions.map((s) => ({ value: s.code, label: s.name, icon: SORT_ICONS[s.code] }))}
          />
        )}
        {/* lista / rács váltó felirat nélkül (keskenyebben mindig rács) */}
        {isDesktop && (
          <div className="view-toggle sliding" ref={viewThumb} role="group" aria-label="Nézet">
            <button
              type="button"
              aria-label="Listás nézet"
              title="Listás nézet"
              aria-pressed={view === 'list'}
              onClick={() => changeView('list')}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Rácsos nézet"
              title="Rácsos nézet"
              aria-pressed={view === 'grid'}
              onClick={() => changeView('grid')}
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
                <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
                <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
                <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
