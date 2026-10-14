'use client';

import { useEffect, useRef } from 'react';

// A Vissza gomb zárja a legfelső ablakot / menüt (terv-3 62, 2026-10-13): telefonon (vissza-gesztus, a
// telepített app is) és a böngészőben a Vissza nem hagyja el az appot, amíg valami nyitva van.
//
// Minden nyitott „réteg” (dialog, menü, panel) egy előzmény-bejegyzést kap (history.pushState, az URL nem
// változik – a Next 16 a natív pushState-et a routerébe illeszti, a lap nem töltődik újra). A Vissza
// (popstate) a legfelső réteget zárja; ha az nem zárható (pl. import közben, mentetlen módosítás), a
// bejegyzés visszakerül. Ha a réteg máshogy zárul (×, Esc, kikattintás), a saját bejegyzését leveszi
// (history.back – az ebből jövő popstate-et kihagyjuk). A bejegyzések egyformák, csak a számuk számít.
//
// A <dialog>-okat egy figyelő (MutationObserver) maga kezeli: a Vissza az Esc-et utánozza (cancel esemény,
// és ha nem tiltották, bezárás) – így minden ablak a saját Esc-szabályai szerint viselkedik. Egy dialog
// saját kezelőt is adhat (dialog.backHandler → 'stay' | 'closing' | undefined), pl. az adatlap előbb a
// lapjait lépteti: minden újabb lapja saját bejegyzést kap (pushDialogPage – 'stepped': a Vissza egy lapot
// vett le). Androidon a nyitott modális ablak a vissza-gesztust magának kérné (bezárási kérés, mint az Esc);
// az adatlap ezért closedby="none" – így a gesztus ide, az előzményekhez jut. A nem dialog rétegek (menük,
// panelek) a useBackLayer horoggal.

const layers = []; // { el?, onBack }
let skip = 0; // a saját history.back()-jeink popstate-je
let waiting = 0; // a visszalépés alatt kért új bejegyzések
let started = false;

// Egy saját history.back() alatt nem teszünk fel új bejegyzést: a Chrome a visszalépés célját a hívásakor
// rögzíti, így a közben feltett bejegyzés után eggyel többet lépne vissza (pl. ⋮ menü → Statisztika: a
// menü bezárul, az ablak ugyanakkor nyílik). Ilyenkor a bejegyzés a visszalépés után kerül fel.
function pushEntry() {
  if (skip > 0) {
    waiting++;
    return;
  }
  window.history.pushState(window.history.state, '');
}

function addLayer(layer) {
  layers.push(layer);
  pushEntry();
  return layer;
}

// a réteg máshogy zárult: a bejegyzései lekerülnek (ha a Vissza zárta, már nincs a listán)
function removeLayer(layer) {
  const i = layers.indexOf(layer);
  if (i === -1) return;
  layers.splice(i, 1);
  skip++;
  window.history.go(-(1 + (layer.extra ?? 0)));
}

// Egy ablakon belüli újabb lap (az adatlap színész- / film-lapja) saját bejegyzést kap: a Vissza ezt
// lépteti, a bejegyzést nem kell visszatenni (a kattintás alatt felvett bejegyzést a Chrome a Vissza
// gombnál nem ugorja át, a popstate-ben visszatettet igen – két Vissza között érintés nélkül)
export function pushDialogPage(el) {
  const layer = layers.find((l) => l.el === el);
  if (!layer) return;
  layer.extra = (layer.extra ?? 0) + 1;
  pushEntry();
}

// a lap a saját gombjával („‹ Vissza”) zárult: a bejegyzése lekerül
export function popDialogPage(el) {
  const layer = layers.find((l) => l.el === el);
  if (!layer?.extra) return;
  layer.extra--;
  skip++;
  window.history.back();
}

function dialogBack(el) {
  const own = el.backHandler?.();
  if (own === 'stepped' || own === 'stay') return own;
  if (own !== 'closing') {
    const ev = new Event('cancel', { cancelable: true });
    el.dispatchEvent(ev);
    if (!ev.defaultPrevented) el.close();
  }
  // ha még nyitva (pl. tiltott Esc, vagy később záruló ablak): a bejegyzés visszakerül, a későbbi
  // bezáráskor a figyelő leveszi
  return el.open ? 'stay' : 'closed';
}

function onPopState() {
  if (skip > 0) {
    skip--;
    if (skip === 0)
      for (; waiting > 0; waiting--) window.history.pushState(window.history.state, '');
    return;
  }
  const top = layers.pop();
  if (!top) return;
  const result = top.onBack();
  if (result === 'stepped' && top.extra > 0) {
    // egy lap bejegyzése ment le: az ablak nyitva marad, új bejegyzés nem kell
    top.extra--;
    layers.push(top);
  } else if (result === 'stay' || result === 'stepped') {
    layers.push(top);
    pushEntry();
  }
}

// a modális dialogok nyitása / zárása (és a nyitva eltávolított dialog)
function watchDialogs() {
  const sync = () => {
    for (const layer of [...layers]) if (layer.el && (!layer.el.open || !layer.el.isConnected)) removeLayer(layer);
    for (const el of document.querySelectorAll('dialog[open]')) {
      if (!el.matches(':modal') || layers.some((l) => l.el === el)) continue;
      addLayer({ el, onBack: () => dialogBack(el) });
    }
  };
  new MutationObserver(sync).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['open'],
  });
  sync();
}

// egyszer, az app indulásakor (app/page.js)
export function startBackClose() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('popstate', onPopState);
  watchDialogs();
}

// nem dialog réteg (menü, panel): amíg open, a Vissza a close-t hívja
export function useBackLayer(open, close) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const layer = addLayer({
      onBack: () => {
        closeRef.current();
        return 'closed';
      },
    });
    return () => removeLayer(layer);
  }, [open]);
}
