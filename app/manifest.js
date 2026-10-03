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
  };
}
