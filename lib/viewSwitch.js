// Lista ↔ rács váltás animálva (terv-3 73, Norbi választása: „B” – lépcsőzetesen, 2026-10-13; látványterv:
// munka/terv-3/tervek-1013/). A váltás előtt a látható borítók helye (captureViewPosters), utána
// (playViewSwitch) mindegyik klónja a régi helyéről az újra siklik, borítónként 22 ms-mal később indulva,
// balról jobbra, sorról sorra; az új nézetben először látszó borítók beúsznak, a szövegek halványan
// előtűnnek. A klónok egy rögzített rétegen mozognak (a valódi borítót a kártya / a sor levágná), a valódi
// borító addig rejtve. Csak asztalon (a nézetváltó csak ott van) és nem „kevesebb mozgás” módban.
// A tételek kulcsa a Reflow-é: data-flip (a rács li-je és a táblázat sora is).

const DURATION = 420; // ms – kivétel a 0,2 s-os szabály alól, mint a borító ↔ adatlap nézetváltás
const STAGGER = 22; // ms borítónként
const POSTER = ':is(.poster, .thumb) > img';

const visible = (r) => r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

export function viewMotionOk() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
}

// a látható borítók: kulcs → { rect, src, radius, filter, opacity }
export function captureViewPosters(root) {
  const out = new Map();
  if (!root) return out;
  for (const item of root.querySelectorAll('[data-flip]')) {
    const img = item.querySelector(POSTER);
    if (!img?.complete || !img.naturalWidth) continue;
    const rect = img.getBoundingClientRect();
    if (!visible(rect)) continue;
    const cs = getComputedStyle(img);
    out.set(item.dataset.flip, {
      rect,
      src: img.currentSrc || img.src,
      radius: getComputedStyle(img.parentElement).borderRadius,
      filter: cs.filter,
      opacity: cs.opacity,
    });
  }
  return out;
}

// az új nézet (root: a rács / a táblázat törzse) a régi borítókból
export function playViewSwitch(before, root, box) {
  if (!root || !before.size) return;
  const items = [...root.querySelectorAll('[data-flip]')]
    .map((item) => ({ item, img: item.querySelector(POSTER) }))
    .filter((x) => x.img)
    .map((x) => ({ ...x, rect: x.img.getBoundingClientRect() }))
    .filter((x) => visible(x.rect))
    .sort((a, b) => Math.round(a.rect.top - b.rect.top) || a.rect.left - b.rect.left);

  box?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: 60, easing: 'ease-out', fill: 'backwards' });

  const layer = document.createElement('div');
  layer.className = 'view-switch-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  const done = [];
  items.forEach(({ item, img, rect }, i) => {
    const delay = i * STAGGER;
    const old = before.get(item.dataset.flip);
    if (!old) {
      // most először látszik: rövid beúszás a siklók után
      img.animate([{ opacity: 0, transform: 'scale(0.94)' }, { opacity: 1, transform: 'none' }], {
        duration: 300,
        delay: 180 + delay,
        easing: 'ease-out',
        fill: 'backwards',
      });
      return;
    }
    const to = getComputedStyle(img);
    const ghost = document.createElement('img');
    ghost.src = old.src;
    ghost.alt = '';
    Object.assign(ghost.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      borderRadius: getComputedStyle(img.parentElement).borderRadius,
    });
    layer.append(ghost);
    img.style.transition = 'none';
    img.style.visibility = 'hidden';
    const anim = ghost.animate(
      [
        {
          transform: `translate(${old.rect.left - rect.left}px, ${old.rect.top - rect.top}px) scale(${old.rect.width / rect.width}, ${old.rect.height / rect.height})`,
          borderRadius: old.radius,
          filter: old.filter,
          opacity: old.opacity,
        },
        { transform: 'none', filter: to.filter, opacity: to.opacity },
      ],
      { duration: DURATION, delay, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'both' }
    );
    // a valódi borító csak betöltve cserél a klónnal (a rács nagyobb képet kér, mint a táblázat)
    const loaded = img.complete ? Promise.resolve() : new Promise((res) => {
      img.addEventListener('load', res, { once: true });
      img.addEventListener('error', res, { once: true });
      setTimeout(res, 1000);
    });
    done.push(
      Promise.all([anim.finished.catch(() => {}), loaded]).then(() => {
        img.style.visibility = '';
        ghost.remove();
        requestAnimationFrame(() => (img.style.transition = ''));
      })
    );
  });
  Promise.all(done).then(() => layer.remove());
}
