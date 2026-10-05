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

// A futó nézetváltás (megnyitáskor): a közben beérkező, nem sürgős frissítések – hangulatszín,
// „Hol nézhető?”, előzetes, hasonló címek, előnézeti adatok – megvárják a végét, hogy a 0,3 s-os
// mozgás ne akadjon meg (terhelt gépen, pl. videó mellett, ezek egy-egy hosszú képkockát
// okoztak a mozgás közepén). Ha nincs nézetváltás, azonnal teljesül.
let running = null;

export function trackTransition(transition) {
  const done = transition.finished
    .catch(() => {})
    .then(() => {
      if (running === done) running = null;
    });
  running = done;
}

export function afterTransition() {
  return running ?? Promise.resolve();
}
