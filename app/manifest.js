// Webalkalmazás-manifest (/manifest.webmanifest): ettől telepíthető az oldal a Chrome-ból /
// Edge-ből saját ablakos alkalmazásként, rendes névvel, filmcsapós ikonnal és sötét címsorral
export default function manifest() {
  return {
    id: '/',
    name: 'Megnézendő filmek és sorozatok',
    short_name: 'Megnézendő filmek',
    description: 'Személyes lista a megnézendő filmekről és sorozatokról',
    lang: 'hu',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#151b24', // --bg
    theme_color: '#1a222d', // --bg-top: a címsor egybeolvad a lap tetejével
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      // Androidra: teljes négyzet, a csapó a kör alakú vágáson belül marad
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // gyorsindítók (terv-3 43, 2026-10-07): jobb klikk a telepített app ikonjára (tálca, Start menü),
    // telefonon hosszan nyomva – a Watchlist a ?nyit=… alapján nyitja meg (SHORTCUTS)
    shortcuts: [
      { name: 'Cím hozzáadása', url: '/?nyit=hozzaadas', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Franchise-ok', url: '/?nyit=franchise-ok', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Statisztika', url: '/?nyit=statisztika', icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
}
