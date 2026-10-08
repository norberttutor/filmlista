'use client';

import { Component } from 'react';

// Animált átrendeződés szűréskor / rendezéskor (terv-3 49.3, 2026-10-08, látványterv nélkül –
// Norbi kérése): ha a trigger (a Watchlist filterKey-e) változik, a megmaradó kártyák / sorok a
// régi helyükről a helyükre csúsznak, a kiesők elhalványulnak, az újak beúsznak (FLIP). Nem View
// Transitions: az a lap fölé rajzolna (a mozgó kártyák a letapadt szűrősor fölé kerülnének), és
// a mozgás alatt a lap nem kattintható.
// A tételek a box (rács / tbody) közvetlen gyerekei, data-flip="<kulcs>" jelzővel; a kiesők
// másolata a layer-be kerül (position: relative; a rácsnál maga a box, a táblázatnál a
// .table-wrap). A mérés a DOM-módosítás előtt kell, ezért osztálykomponens
// (getSnapshotBeforeUpdate). A „kevesebb mozgás” beállításnál nem mozog.
const ID = 'reflow';
const MOVE = { duration: 320, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' };

export default class Reflow extends Component {
  ghosts = new Set();

  getSnapshotBeforeUpdate(prev) {
    if (prev.trigger === this.props.trigger) return null;
    const box = this.props.boxRef.current;
    const layer = this.props.layerRef?.current ?? box;
    if (!box || !layer || !canAnimate()) return null;
    const base = layer.getBoundingClientRect();
    const items = new Map();
    for (const el of box.children) {
      const key = el.dataset.flip;
      if (key == null) continue;
      // a látható hely (egy félbehagyott mozgásból is onnan folytatja), a középpontja a
      // rétegben – a méret a transzformáció nélküli (a görgetéses beúszás kicsinyít)
      const r = el.getBoundingClientRect();
      items.set(key, {
        el,
        x: r.left + r.width / 2 - base.left,
        y: r.top + r.height / 2 - base.top,
        w: el.offsetWidth,
        h: el.offsetHeight,
        seen: onScreen(r),
      });
    }
    // táblázatnál a kieső sor másolata saját táblázatba kerül, az oszlopszélességekkel
    const table = box.closest('table');
    const tableInfo = table && {
      className: table.className,
      x: table.getBoundingClientRect().left - base.left,
      width: table.offsetWidth,
      cols: [...(table.tHead?.rows[0]?.cells ?? [])].map((c) => c.getBoundingClientRect().width),
    };
    return { items, tableInfo };
  }

  componentDidUpdate(prev, state, snap) {
    if (!snap) return;
    const box = this.props.boxRef.current;
    const layer = this.props.layerRef?.current ?? box;
    if (!box || !layer) return;
    const current = [...box.children].filter((el) => el.dataset.flip != null);
    // előbb minden futó mozgás leáll (a végleges helyet mérjük), aztán egyszerre mérünk
    for (const el of current) for (const a of el.getAnimations()) if (a.id === ID) a.cancel();
    const base = layer.getBoundingClientRect();
    const placed = current.map((el) => [el, el.getBoundingClientRect()]);

    for (const [el, r] of placed) {
      const old = snap.items.get(el.dataset.flip);
      if (old) {
        const dx = old.x - (r.left + r.width / 2 - base.left);
        const dy = old.y - (r.top + r.height / 2 - base.top);
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
        if (!old.seen && !onScreen(r)) continue;
        // composite: add – a görgetéses beúszás (card-in) transzformációja megmarad alatta
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
          ...MOVE,
          composite: 'add',
          id: ID,
        });
      } else if (onScreen(r)) {
        // új tétel: a kiesők halványulása alatt kicsit később úszik be
        const timing = { duration: 280, delay: 90, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards', id: ID };
        el.animate([{ opacity: 0 }, { opacity: 1 }], timing);
        el.animate([{ transform: 'translateY(14px) scale(0.97)' }, { transform: 'none' }], { ...timing, composite: 'add' });
      }
    }

    const present = new Set(current.map((el) => el.dataset.flip));
    for (const [key, old] of snap.items) {
      if (present.has(key) || !old.seen) continue;
      this.fadeOut(old, snap.tableInfo, layer);
    }
  }

  // a kieső tétel másolata a régi helyén elhalványul (nem kattintható, felolvasó nem látja)
  fadeOut(old, tableInfo, layer) {
    const copy = old.el.cloneNode(true);
    copy.removeAttribute('data-flip');
    for (const el of [copy, ...copy.querySelectorAll('[id]')]) el.removeAttribute('id');
    let ghost = copy;
    if (tableInfo) {
      ghost = document.createElement('table');
      ghost.className = tableInfo.className;
      const cols = document.createElement('colgroup');
      for (const w of tableInfo.cols) {
        const col = document.createElement('col');
        col.style.width = `${w}px`;
        cols.append(col);
      }
      const body = document.createElement('tbody');
      body.append(copy);
      ghost.append(cols, body);
      ghost.style.width = `${tableInfo.width}px`;
      ghost.style.left = `${tableInfo.x}px`;
    } else {
      ghost.style.width = `${old.w}px`;
      ghost.style.left = `${old.x - old.w / 2}px`;
    }
    ghost.style.height = `${old.h}px`;
    ghost.style.top = `${old.y - old.h / 2}px`;
    ghost.classList.add('reflow-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    layer.append(ghost);
    this.ghosts.add(ghost);
    const done = () => {
      ghost.remove();
      this.ghosts.delete(ghost);
    };
    const a = ghost.animate(
      [{ opacity: 1 }, { opacity: 0, transform: 'scale(0.94)' }],
      { duration: 200, easing: 'ease-in', fill: 'forwards' }
    );
    a.onfinish = done;
    a.oncancel = done;
  }

  componentWillUnmount() {
    for (const g of this.ghosts) g.remove();
    this.ghosts.clear();
  }

  render() {
    return this.props.children;
  }
}

function canAnimate() {
  return (
    typeof Element.prototype.animate === 'function' &&
    !document.hidden &&
    window.matchMedia('(prefers-reduced-motion: no-preference)').matches
  );
}

function onScreen(r) {
  return r.bottom > 0 && r.top < window.innerHeight && r.width > 0;
}
