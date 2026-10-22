'use client';

// A fő lista (Norbi oldala): fejléc, szűrősor, lista / rács, lapozás és az ablakok. A részei a components/list/
// mappában: adatok és betöltés (useListData, backgroundRefresh), értesítések (useNotificationList), szűrők
// (useListFilters, FilterBar), lapozás (usePaging), fejléc (useCollapsingHeader), nézet (useListView), módosítások
// (useListChanges), élő szinkron (useLiveTitles), ⋮ menü (moreItems).
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import PosterCard from '@/components/PosterCard';
import Pagination from '@/components/Pagination';
import ImdbRatingsImport from '@/components/ImdbRatingsImport';
import TitleSearch from '@/components/TitleSearch';
import { recommendSeeds } from '@/components/Discover';
import TitleEditor from '@/components/TitleEditor';
import TitleTable from '@/components/TitleTable';
import Reflow from '@/components/Reflow';
import { titleKey } from '@/lib/titles';
import FranchiseCollection from '@/components/FranchiseCollection';
import NotificationBell from '@/components/NotificationBell';
import BulkImport from '@/components/BulkImport';
import ListSkeleton from '@/components/ListSkeleton';
import StatsDialog from '@/components/StatsDialog';
import ManualDialog from '@/components/ManualDialog';
import PasswordDialog from '@/components/PasswordDialog';
import BackupsDialog from '@/components/BackupsDialog';
import ErrorsDialog from '@/components/ErrorsDialog';
import MoreMenu from '@/components/MoreMenu';
import ThemeToggle from '@/components/ThemeToggle';
import NeonBrand from '@/components/NeonBrand';
import { useTheme } from '@/lib/theme';
import FranchisesDialog from '@/components/FranchisesDialog';
import PeopleDialog from '@/components/PeopleDialog';
import ToplistsDialog from '@/components/ToplistsDialog';
import Toaster from '@/components/Toaster';
import EmptyState from '@/components/EmptyState';
import { shownNotifications } from '@/lib/notifications';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { canMorph, MORPH_NAME, trackTransition } from '@/lib/viewTransition';
import { signOut } from '@/lib/offline';
import { SearchHighlight } from '@/components/Highlight';
import { useBackLayer } from '@/lib/backClose';
import PullRefresh from '@/components/PullRefresh';
import { errorCounts } from '@/lib/errorLog';
import FilterBar from '@/components/list/FilterBar';
import SearchNote from '@/components/list/SearchNote';
import { moreMenuItems } from '@/components/list/moreItems';
import { useListData } from '@/components/list/useListData';
import { useMissingLogos } from '@/components/list/backgroundRefresh';
import { useAppBadge, useNotificationList } from '@/components/list/useNotificationList';
import { useListFilters } from '@/components/list/useListFilters';
import { GRID_PAGE_SIZE, PAGE_SIZE, TABLE_PAGE_SIZE, usePaging } from '@/components/list/usePaging';
import { useCollapsingHeader } from '@/components/list/useCollapsingHeader';
import { useListView } from '@/components/list/useListView';
import { useListChanges } from '@/components/list/useListChanges';
import { useLiveTitles } from '@/components/list/useLiveTitles';

// a helyben tárolt lista ideje: „okt. 8. 21:14”
const snapshotTime = (iso) =>
  new Date(iso).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// ennél szélesebb képernyőn választható a soros (táblázatos) nézet és a borítófal, alatta
// mindig borítófal
const DESKTOP_QUERY = '(min-width: 1400px)';
const PHONE_QUERY = '(max-width: 640px)'; // telefonos nézet

// a telepített app gyorsindítói (app/manifest.js, terv-3 43): ?nyit=… → mit nyisson meg
const SHORTCUTS = {
  hozzaadas: ({ openAdd }) => openAdd(),
  'franchise-ok': ({ openDialog }) => openDialog('franchises'),
  statisztika: ({ openDialog }) => openDialog('stats'),
};

export default function Watchlist({ session }) {
  const theme = useTheme();
  const userId = session.user.id;
  const notes = useNotificationList();
  const data = useListData(userId, notes);
  const { titles, statuses, franchises, orders, loading, loadError, stale, failed, online, readOnly } = data;
  const { notifications } = notes;

  // hibanapló (terv-3 113): a ⋮ „Hibák (N)” csak akkor látszik, ha van naplózott hiba; N: az olvasatlanok
  const [errorInfo, setErrorInfo] = useState({ total: 0, unseen: 0 });
  const refreshErrorInfo = () =>
    errorCounts()
      .then(setErrorInfo)
      .catch((err) => console.warn('A hibanapló számlálója nem tölthető be:', err.message));
  useEffect(() => {
    if (online) refreshErrorInfo();
  }, [userId, online]);

  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState(''); // a „Cím hozzáadása” panel kezdő keresése
  // a nyitott ablak: 'stats' | 'franchises' | 'people' (M4) | 'toplists' (terv-3 120) | 'backups' | 'errors' |
  // 'manual' | 'password' (terv-3 27), vagy null
  const [dialog, setDialog] = useState(null);
  const openDialog = (name) => setDialog(name);
  const closeDialog = () => setDialog(null);
  // a ⋮ menüből nyíló importok (a saját ablakukat / fájlválasztójukat nyitják)
  const imdbImportRef = useRef(null);
  const bulkImportRef = useRef(null);
  // a szerkesztő ablakban megnyitott cím (a lista sora, vagy egy TMDB-találat előnézete), vagy null
  const [editing, setEditing] = useState(null);
  // a borító, amelyről a szerkesztő nyílt: oda siklik vissza bezáráskor (nézetváltás)
  const editorFrom = useRef(null);

  // szerkesztő megnyitása: asztalon a kattintott borító átsiklik az ablak nagy borítójának
  // helyére (lib/viewTransition.js); egyébként egyszerűen megnyílik
  function openEditor(t, fromEl = null) {
    editorFrom.current = fromEl;
    if (!canMorph(fromEl)) {
      setEditing(t);
      return;
    }
    fromEl.style.viewTransitionName = MORPH_NAME;
    const transition = document.startViewTransition(() => {
      fromEl.style.viewTransitionName = '';
      flushSync(() => setEditing(t));
    });
    trackTransition(transition); // a szerkesztő nem sürgős frissítései megvárják a végét
  }

  const isDesktop = useMediaQuery(DESKTOP_QUERY);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const { view, changeView, gridRef } = useListView();

  const franchiseName = useMemo(
    () => new Map(franchises.map((f) => [f.id, f.name])),
    [franchises]
  );

  // az app ikonján ugyanannyi olvasatlan, amennyit a harang mutat (kódaudit #20)
  const titleById = useMemo(() => new Map(titles.map((t) => [t.id, t])), [titles]);
  const unreadCount = shownNotifications(notifications, titleById, franchiseName).filter((n) => !n.read_at).length;
  useAppBadge(unreadCount);

  const f = useListFilters({ titles, statuses, franchises, orders, franchiseName });
  const { visible, ofType, filterKey, searching } = f;

  // a keresőben ezek alapján látszik, mi van már a listán
  const existingKeys = useMemo(() => new Set(titles.map(titleKey)), [titles]);

  useMissingLogos(!loading && !readOnly, titles, franchises, data.setFranchises);

  // a szűrősor eredeti helye: lapozáskor ide görget (a letapadt szűrősorhoz nem lehetne)
  const filtersAnchorRef = useRef(null);
  const pageSize = !isDesktop ? PAGE_SIZE : view === 'grid' ? GRID_PAGE_SIZE : TABLE_PAGE_SIZE;
  const listShown = !loading && !loadError;
  const { page, pageCount, paged, changePage, paging } = usePaging(visible, filterKey, pageSize, filtersAnchorRef, listShown);
  const { headRef, filtersRef, filtersStuck, fabHidden } = useCollapsingHeader(listShown, adding);

  const changes = useListChanges({
    data,
    keepShown: f.keepShown,
    releaseFranchise: f.releaseFranchise,
    openFranchises: () => openDialog('franchises'),
  });
  const { handleAdded, handleRowUpdated, requestDelete } = changes;
  const onUpdatedQuiet = (row) => handleRowUpdated(row, false); // a gyűjtemény-ablakokból: nem kérdez értékelést

  useLiveTitles(!loading && !readOnly && !failed, userId, {
    data,
    notes,
    replaceTitle: changes.replaceTitle,
    releaseFranchise: f.releaseFranchise,
  });

  // a Franchise-ok ablakból („Szűrés erre”): a lista ennek a franchise-nak minden címét mutatja, a lista
  // elejére görget
  function showFranchise(id) {
    f.showFranchise(id);
    closeDialog();
    filtersAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // a „Cím hozzáadása” panel (opcionálisan kitöltött kereséssel), a lap tetején
  function openAdd(q = '') {
    setAddQuery(q);
    setAdding(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  // a „Cím hozzáadása” panelt a Vissza gomb is bezárja (terv-3 62)
  useBackLayer(adding && !readOnly, () => setAdding(false));

  // gyorsindítók (terv-3 43): a telepített app ikonjának menüjéből /?nyit=… címmel indul – a lista
  // betöltése után egyszer megnyitja a kért részt, és a címből eltünteti a paramétert (újratöltéskor
  // ne nyíljon újra). Belépés nélkül a cím a belépés után is megmarad, így akkor nyílik.
  const shortcutDone = useRef(false);
  useEffect(() => {
    if (loading || shortcutDone.current) return;
    shortcutDone.current = true;
    const url = new URL(window.location.href);
    const target = url.searchParams.get('nyit');
    if (!target) return;
    url.searchParams.delete('nyit');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    if (loadError) return;
    SHORTCUTS[target]?.({ openAdd, openDialog });
  }, [loading, loadError]);

  // a ⋮ menü pontjai – a fejlécben és (asztalon, lejjebb görgetve) a letapadt szűrősorban is
  const moreItems = moreMenuItems({
    theme,
    isPhone,
    isDesktop,
    readOnly,
    titles,
    franchiseName,
    errorInfo,
    openDialog,
    imdbImport: imdbImportRef,
    bulkImport: bulkImportRef,
  });

  // a harang a fejlécben és a letapadt szűrősorban
  const bellProps = {
    notifications,
    titles,
    franchiseName,
    onOpenTitle: (t) => openEditor(t),
    onRead: notes.readNotifications,
    onRemove: notes.removeNotifications,
    readOnly,
  };

  return (
    // data-list: honnan jön a lista (a teszt ezen várja meg a friss adatot); data-docked: asztalon a lábléc (és a
    // lapozó, ha van) az ablak alján – egyoldalas találatnál is ugyanaz a keskeny lábléc (átnézés K4)
    <main
      data-list={loading ? 'loading' : stale ? 'stale' : 'live'}
      data-docked={isDesktop ? '' : undefined}
      // asztalon összecsukva a fejléc sávja is felgördül (CSS: --head-c 0) – a nyitott „Cím hozzáadása” panelnél nem
      data-head-away={adding && !readOnly ? undefined : ''}
      // net nélkül a tiltott vezérlők halványabbak (CSS, átnézés J3)
      data-readonly={readOnly ? '' : undefined}
    >
      <header className="top collapsing" ref={headRef}>
        {/* összecsukva a sáv bal szélén a kis cím (terv-3 99); felolvasónak a nagy cím elég */}
        <p className="top-compact" aria-hidden="true">
          <span className="long">Megnézendő filmek és sorozatok</span>
          <span className="short">Megnézendő filmek</span>
        </p>
        <div className="top-title">
          <NeonBrand />
          {!loading && !loadError && (
            <p className="count">
              {titles.length} cím a listán
              {/* a tárolt lista látszik, a friss a háttérben jön (a sáv csak hibánál szól) */}
              {stale && online && !failed && <span className="muted"> · frissítés…</span>}
            </p>
          )}
        </div>
        <div className="account">
          {/* csak olvasható módban is a helyén marad, tiltva: ha eltűnne, a friss lista érkezésekor a fejléc sora
              másként törne, és az egész lista megugrana (terv-3 131, P1) */}
          {!loading && !loadError && (
            <button
              type="button"
              className="primary"
              disabled={readOnly}
              aria-expanded={adding && !readOnly}
              aria-controls="add-panel"
              onClick={() => (adding ? setAdding(false) : openAdd())}
            >
              Cím hozzáadása
            </button>
          )}
          {!loading && !loadError && <NotificationBell {...bellProps} />}
          {/* az e-mail-címre kattintva a jelszó módosítása (terv-3 27; net nélkül csak felirat) */}
          {readOnly ? (
            <span className="muted small">{session.user.email}</span>
          ) : (
            <button
              type="button"
              className="muted small account-email"
              title="Jelszó módosítása"
              aria-label={`${session.user.email} – jelszó módosítása`}
              onClick={() => openDialog('password')}
            >
              {session.user.email}
            </button>
          )}
          <button type="button" className="ghost" onClick={signOut}>
            Kilépés
          </button>
          {/* világos / sötét téma (terv-3 50, Norbi kérése: a ⋮ menü mellett) */}
          <ThemeToggle />
          {/* a ritkábban használt műveletek a ⋮ menüben (mint a Chrome-ban); a tömeges import és
              a mentés csak asztali nézetben */}
          {!loading && !loadError && (
            <>
              <MoreMenu items={moreItems} />
              <ImdbRatingsImport
                ref={imdbImportRef}
                titles={titles}
                onApplied={changes.applyRatingsLocally}
                onAdded={handleAdded}
              />
              {isDesktop && (
                <BulkImport
                  ref={bulkImportRef}
                  existingKeys={existingKeys}
                  onAdded={handleAdded}
                />
              )}
            </>
          )}
        </div>
      </header>

      {/* betöltés közben csontváz: a nézetnek megfelelő sorok / kártyák körvonala */}
      {loading && <ListSkeleton table={isDesktop && view === 'list'} />}
      {loadError && (
        <p className="state error" role="alert">
          {loadError}
        </p>
      )}
      {/* net nélkül (vagy ha a szerver nem érhető el): a tárolt / már betöltött lista, csak olvasható */}
      {!loading && !loadError && (!online || (stale && failed)) && (
        <p className="offline-note" role="status">
          {/* a szöveg a valódi ok szerint (S10): van net, csak a szerver nem válaszol */}
          <strong>{online ? 'A szerver most nem érhető el.' : 'Nincs internetkapcsolat.'}</strong>{' '}
          {stale ? `A lista a ${snapshotTime(stale)}-kor elmentett állapotot mutatja; ` : ''}
          most csak nézelődni lehet.{' '}
          {online ? 'Hamarosan magától újrapróbálom.' : 'Ha visszajön a net, magától frissül.'}
        </p>
      )}

      {!loading && !loadError && (
        <>
          {adding && !readOnly && (
            <TitleSearch
              key={addQuery}
              initialQuery={addQuery}
              existingKeys={existingKeys}
              recommendSeeds={recommendSeeds(titles)}
              onAdded={handleAdded}
              onPreview={openEditor}
              onPerson={(person) => openEditor({ person })}
              onClose={() => setAdding(false)}
            />
          )}

          <div ref={filtersAnchorRef} className="filters-anchor" aria-hidden="true" />
          <FilterBar
            f={f}
            isPhone={isPhone}
            isDesktop={isDesktop}
            view={view}
            changeView={changeView}
            sectionRef={filtersRef}
            stuck={filtersStuck}
            // nyitott „Cím hozzáadása” panelnél a fejléc sávja marad (benne ezek), a letapadt sávban csak a „↑”
            stuckTools={
              !adding && (
                <>
                  {!readOnly && (
                    <button type="button" className="primary" aria-label="Cím hozzáadása" title="Cím hozzáadása" onClick={() => openAdd()}>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  )}
                  <NotificationBell quiet {...bellProps} />
                  <MoreMenu items={moreItems} />
                </>
              )
            }
          />

          {/* franchise-ra szűrve: a gyűjtemény sávja (hány címét láttad; az ablakban a TMDB-gyűjtemények, a további címek, kézi hozzárendelés) */}
          {f.franchiseChosen && !searching && franchiseName.has(Number(f.franchise)) && (
            <FranchiseCollection
              key={f.franchise}
              franchise={franchises.find((x) => String(x.id) === f.franchise)}
              franchiseNames={franchiseName}
              titles={titles}
              orders={orders}
              onAdded={handleAdded}
              onUpdated={onUpdatedQuiet}
              onOrderChanged={changes.handleOrderChanged}
              onFranchiseUpdated={changes.handleFranchiseUpdated}
              onRename={changes.handleRenameFranchise}
              onDelete={changes.handleDeleteFranchise}
              readOnly={readOnly}
            />
          )}

          <SearchHighlight.Provider value={f.highlight}>
          {/* keresésnél: elírás javítva, ill. a franchise neve szerinti találatok (terv-3 66) */}
          {searching && visible.length > 0 && (f.corrected.length > 0 || f.frMatches) && <SearchNote f={f} />}

          {/* üres állapot: net nélkül (readOnly) a hozzáadó gombok nem látszanak (kódaudit #8) */}
          {titles.length === 0 ? (
            <EmptyState
              title="A listád még üres"
              text="Keress rá egy filmre vagy sorozatra, vagy válassz a népszerűek közül."
            >
              {!readOnly && (
                <button type="button" className="primary" onClick={() => openAdd()}>
                  Első cím hozzáadása
                </button>
              )}
              {isDesktop && !readOnly && (
                <button type="button" className="ghost" onClick={() => bulkImportRef.current?.open()}>
                  Tömeges import
                </button>
              )}
            </EmptyState>
          ) : ofType.length === 0 ? (
            <EmptyState
              title={`Még nincs ${f.type === 'tv' ? 'sorozat' : 'film'} a listádon`}
              text="Váltsd át a típust, vagy adj hozzá egyet."
            >
              {!readOnly && (
                <button type="button" className="primary" onClick={() => openAdd()}>
                  {f.type === 'tv' ? 'Sorozat' : 'Film'} hozzáadása
                </button>
              )}
              <button type="button" className="ghost" onClick={() => f.changeType(f.type === 'tv' ? 'movie' : 'tv')}>
                {f.type === 'tv' ? 'Filmek' : 'Sorozatok'} mutatása
              </button>
            </EmptyState>
          ) : visible.length === 0 && searching ? (
            // a keresés a listán nem talált: egy kattintással a TMDB-n keres tovább
            <EmptyState
              title={`Nincs „${f.query.trim()}” a listádon`}
              text={
                f.atSearchFilters
                  ? 'A címekben, az eredeti címekben és a franchise-ok nevében kerestem, a szűrőktől függetlenül.'
                  : `A címekben, az eredeti címekben és a franchise-ok nevében kerestem, ezzel a szűréssel: ${f.filterSummary}.`
              }
            >
              {!readOnly && (
                <button type="button" className="primary" onClick={() => openAdd(f.query.trim())}>
                  Keresés a TMDB-n: „{f.query.trim()}”
                </button>
              )}
              {f.atSearchFilters ? (
                <button type="button" className="ghost" onClick={() => f.changeQuery('')}>
                  Keresés törlése
                </button>
              ) : (
                <button type="button" className="ghost" onClick={f.clearFilters}>
                  Szűrők törlése
                </button>
              )}
            </EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState title="Nincs a szűrésnek megfelelő cím" text={`Szűrés: ${f.filterSummary}.`}>
              <button type="button" className="primary" onClick={f.clearFilters}>
                Szűrők törlése
              </button>
              {!readOnly && (
                <button type="button" className="ghost" onClick={() => openAdd()}>
                  Felfedezés
                </button>
              )}
            </EmptyState>
          ) : isDesktop && view === 'list' ? (
            <TitleTable
              entries={paged}
              statuses={statuses}
              franchises={franchises}
              onCreateFranchise={changes.handleCreateFranchise}
              onDeleteFranchise={changes.handleDeleteFranchise}
              onRenameFranchise={changes.handleRenameFranchise}
              onEdit={openEditor}
              onUpdated={handleRowUpdated}
              onDelete={requestDelete}
              readOnly={readOnly}
              paging={paging}
              reflowKey={filterKey}
            />
          ) : (
            <Reflow trigger={filterKey} boxRef={gridRef}>
              <ul ref={gridRef} className="grid" data-paging={paging ? '' : undefined}>
                {paged.map((e) => (
                  <li key={e.key} data-flip={e.key}>
                    <PosterCard
                      title={e.title}
                      item={e.item}
                      franchise={franchiseName.get(e.title.franchise_id)}
                      onEdit={openEditor}
                    />
                  </li>
                ))}
              </ul>
            </Reflow>
          )}
          </SearchHighlight.Provider>

          {ofType.length > 0 && (
            <Pagination
              page={page}
              pageCount={pageCount}
              total={visible.length}
              pageSize={pageSize}
              onChange={changePage}
              docked={isDesktop} // asztalon lista- és rácsnézetben is az ablak alján (egységesen, Norbi kérése, 2026-10-15)
            />
          )}
        </>
      )}

      {dialog === 'franchises' && (
        <FranchisesDialog
          franchises={franchises}
          titles={titles}
          orders={orders}
          onCreate={changes.handleCreateFranchise}
          onRename={changes.handleRenameFranchise}
          onDelete={changes.handleDeleteFranchise}
          onShow={showFranchise}
          onAdded={handleAdded}
          onUpdated={onUpdatedQuiet}
          onOrderChanged={changes.handleOrderChanged}
          onFranchiseUpdated={changes.handleFranchiseUpdated}
          onClose={closeDialog}
          readOnly={readOnly}
        />
      )}
      {dialog === 'people' && (
        <PeopleDialog
          titles={titles}
          userId={userId}
          onClose={closeDialog}
          onPreview={(item) => openEditor(item)}
          onPerson={(person) => openEditor({ person })}
          onAdded={handleAdded}
        />
      )}
      {dialog === 'toplists' && (
        <ToplistsDialog
          titles={titles}
          onClose={closeDialog}
          onPreview={(item) => openEditor(item)}
          onAdded={handleAdded}
          readOnly={readOnly}
        />
      )}
      {dialog === 'stats' && <StatsDialog titles={titles} franchiseName={franchiseName} onClose={closeDialog} />}

      {dialog === 'manual' && <ManualDialog onClose={closeDialog} />}
      {dialog === 'password' && <PasswordDialog email={session.user.email} onClose={closeDialog} />}

      {dialog === 'errors' && <ErrorsDialog userId={userId} onChanged={refreshErrorInfo} onClose={closeDialog} />}

      {dialog === 'backups' && (
        <BackupsDialog titleCount={titles.length} onRestored={data.reloadAfterRestore} onClose={closeDialog} />
      )}

      {/* telefonon lebegő "+" gomb a fejléc "Cím hozzáadása" gombja helyett (a CSS csak
          640 px alatt mutatja); lefelé görgetéskor elhúzódik; nyitott panelnél nincs (takarná a találatokat – J7) */}
      {!loading && !loadError && !readOnly && !adding && (
        <button
          type="button"
          className={fabHidden ? 'fab hidden' : 'fab'}
          aria-label="Cím hozzáadása"
          aria-expanded={adding}
          aria-controls="add-panel"
          onClick={() => openAdd()}
        >
          <svg
            viewBox="0 0 24 24"
            width="26"
            height="26"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {editing && (
        <TitleEditor
          title={editing}
          titles={titles}
          statuses={statuses}
          franchises={franchises}
          onCreateFranchise={changes.handleCreateFranchise}
          onDeleteFranchise={changes.handleDeleteFranchise}
          onRenameFranchise={changes.handleRenameFranchise}
          existingKeys={existingKeys}
          onAdded={handleAdded}
          onChanged={changes.replaceTitle}
          onDelete={requestDelete}
          readOnly={readOnly}
          morphTo={editorFrom.current}
          onClose={() => setEditing(null)}
        />
      )}

      <PullRefresh enabled={!loading} onRefresh={data.pullRefresh} />
      <Toaster />
    </main>
  );
}
