// Nézetváltás a borító és a szerkesztő ablak között (View Transitions): a kattintott kártya /
// sor borítója átsiklik az ablak nagy borítójának helyére, bezáráskor vissza. A szerkesztő
// nagy borítója a CSS-ben kapja a nevet (.title-editor .editor-poster), a forrás borító csak a
// váltás idejére.
export const MORPH_NAME = 'editor-poster';

// csak ha a böngésző tudja, asztalon (a szerkesztőben ott van nagy borító, ≥ 900 px), és ha
// nincs bekapcsolva a "kevesebb mozgás"
export function canMorph(el) {
  return Boolean(
    el?.isConnected &&
      typeof document.startViewTransition === 'function' &&
      window.matchMedia('(min-width: 900px) and (prefers-reduced-motion: no-preference)').matches
  );
}
