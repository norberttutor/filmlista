'use client';

// Beröppenő borító (terv-3 134): a felvett cím kis borítójának másolata ív mentén a fejléc „N cím a listán” sorához
// repül (összecsukott fejlécnél a kis címhez), ott elfogy, és a szám egyet dobban. Web Animations, 0,55 s; a
// másolat a body-ban (.flying-poster, 36-mozgas.css). „Kevesebb mozgás”-nál és ha a cél nem látszik, nem repül –
// akkor csak a szám dobban (a „kevesebb mozgás” azt is elnyeli). A 136 (Mama „Érdekel” füle) is ezt használja.

const canFly = () =>
  typeof Element.prototype.animate === 'function' &&
  !document.hidden &&
  window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

const visible = (r) => r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;

// from: a forrás (a borító képe, vagy ha az nincs, egy elem – akkor kis álló kép a közepén); src: a kép címe;
// to: a cél eleme. Visszaad egy ígéretet, amely a leérkezéskor (vagy repülés nélkül rögtön) teljesül.
export function flyPoster({ from, src, to, lift = 110, ms = 550 }) {
  return new Promise((done) => {
    if (!from || !to || !src || !canFly()) return done();
    const r = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    if (!visible(r) || !visible(b)) return done();
    const isImg = from.tagName === 'IMG';
    const w = isImg ? r.width : 40;
    const h = isImg ? r.height : 60;
    const left = r.left + r.width / 2 - w / 2;
    const top = r.top + r.height / 2 - h / 2;
    const copy = document.createElement('img');
    copy.className = 'flying-poster';
    copy.alt = '';
    copy.src = (isImg && from.currentSrc) || src;
    copy.setAttribute('aria-hidden', 'true');
    Object.assign(copy.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` });
    document.body.append(copy);
    // másodfokú Bézier-ív: fel, majd le a célra; közben összemegy, a végén elhalványul
    const ex = b.left + b.width / 2 - (left + w / 2);
    const ey = b.top + b.height / 2 - (top + h / 2);
    const cx = ex * 0.45;
    const cy = Math.min(0, ey) - lift;
    const frames = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const u = 1 - t;
      const x = 2 * u * t * cx + t * t * ex;
      const y = 2 * u * t * cy + t * t * ey;
      frames.push({ transform: `translate(${x}px, ${y}px) scale(${1 - 0.8 * t})`, opacity: t < 0.82 ? 1 : 1 - (t - 0.82) / 0.18 });
    }
    const a = copy.animate(frames, { duration: ms, easing: 'cubic-bezier(0.5, 0, 0.3, 1)' });
    const finish = () => {
      copy.remove();
      done();
    };
    a.onfinish = finish;
    a.oncancel = finish;
  });
}

// a szám egyet dobban (data-bump, 36-mozgas.css); újraindítható
export function bump(el) {
  if (!el) return;
  el.removeAttribute('data-bump');
  void el.offsetWidth;
  el.setAttribute('data-bump', '');
  clearTimeout(el.bumpTimer);
  el.bumpTimer = setTimeout(() => el.removeAttribute('data-bump'), 450);
}

// a fő lista fejlécének célja: összecsukva a kis cím, különben a szám
export function listCountTarget() {
  const head = document.querySelector('header.top');
  if (!head) return null;
  return head.hasAttribute('data-compact') ? head.querySelector('.top-compact') : head.querySelector('.count-n');
}

// felvétel a „Cím hozzáadása” panelen: a borító a fejléchez repül, a szám dobban
export function flyToList(from, src) {
  return flyPoster({ from, src, to: listCountTarget() }).then(() => bump(document.querySelector('header.top .count-n')));
}
