// A fő lista ⋮ menüjének pontjai (components/MoreMenu.js) – a fejlécben és (asztalon, lejjebb görgetve) a letapadt
// szűrősorban is (components/Watchlist.js)
import { downloadListCsv } from '@/lib/exportList';

// a ⋮ menü pontjai, amelyek net nélkül nem működnének (csak olvasható módban nem látszanak); a
// Színészek ablak a TMDB-ről számol (M4)
const ONLINE_ONLY = ['imdb', 'bulk', 'backups', 'password', 'people', 'toplists', 'errors'];

// openDialog(név): a Watchlist ablakai; imdbImport / bulkImport: az importok ref-jei (a saját ablakukat /
// fájlválasztójukat nyitják); errorInfo: a hibanapló számlálója (terv-3 113)
export function moreMenuItems({
  isPhone,
  isDesktop,
  readOnly,
  titles,
  franchiseName,
  errorInfo,
  openDialog,
  imdbImport,
  bulkImport,
}) {
  return [
    {
      id: 'stats',
      label: 'Statisztika',
      description: 'Havonta megnézett címek, műfajok, átlagos értékelés',
      icon: 'chart',
      onSelect: () => openDialog('stats'),
    },
    {
      id: 'franchises',
      label: 'Franchise-ok',
      description: 'Az összes franchise logóval, ábécérendben; gyűjtemény, szűrés, átnevezés',
      icon: 'stack',
      onSelect: () => openDialog('franchises'),
    },
    {
      id: 'people',
      label: 'Színészek és rendezők',
      description: 'Akiket követsz: a filmjeik megjelenés szerint; szólok, ha újat jelentenek be',
      icon: 'people',
      onSelect: () => openDialog('people'),
    },
    {
      id: 'toplists',
      label: 'Toplisták',
      description: 'A legjobb filmek és sorozatok IMDb szerint – műfaj és évtized szerint is',
      icon: 'trophy',
      onSelect: () => openDialog('toplists'),
    },
    // a CSV-fájl betöltése asztali / tableten végzett teendő: telefonon nincs (Norbi kérése)
    ...(isPhone
      ? []
      : [
          {
            id: 'imdb',
            label: 'IMDb import',
            description: 'Az IMDb-értékeléseid vagy a figyelőlistád (Watchlist) CSV-exportjából: csillagok, új címek',
            icon: 'star',
            onSelect: () => imdbImport.current?.open(),
          },
        ]),
    ...(isDesktop
      ? [
          {
            id: 'bulk',
            label: 'Tömeges import',
            description: 'Sok cím felvétele egyszerre, soronként egy címmel',
            icon: 'list',
            onSelect: () => bulkImport.current?.open(),
          },
          {
            id: 'export',
            label: 'Mentés letöltése',
            description: `A teljes lista (${titles.length} cím) CSV-fájlba – Excelben megnyitható`,
            icon: 'download',
            onSelect: () => downloadListCsv(titles, franchiseName),
          },
        ]
      : []),
    // téma (a videotéka is – D10) és színpár (terv-3 142)
    {
      id: 'appearance',
      label: 'Kinézet',
      description: 'Sötét, világos vagy videotéka-téma; a gombok és a neonfelirat színpárja',
      icon: 'palette',
      onSelect: () => openDialog('appearance'),
    },
    {
      id: 'backups',
      label: 'Mentések',
      description: 'Heti automatikus mentés; mentés most, visszaállítás',
      icon: 'history',
      onSelect: () => openDialog('backups'),
    },
    {
      id: 'password',
      label: 'Jelszó módosítása',
      description: 'Új jelszó a belépéshez (a jelenlegivel)',
      icon: 'key',
      onSelect: () => openDialog('password'),
    },
    {
      id: 'manual',
      label: 'Felhasználói leírás',
      description: 'Minden funkció, képekkel',
      icon: 'book',
      onSelect: () => openDialog('manual'),
    },
    // hibanapló (terv-3 113): csak ha van mit mutatni
    ...(errorInfo.total > 0
      ? [
          {
            id: 'errors',
            label: errorInfo.unseen > 0 ? `Hibák (${errorInfo.unseen})` : 'Hibák',
            description: 'Ami a böngészőben elromlott (nálad vagy Mamánál) – másolható leírással',
            icon: 'alert',
            onSelect: () => openDialog('errors'),
          },
        ]
      : []),
  ].filter((item) => !readOnly || !ONLINE_ONLY.includes(item.id));
}
