'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { pickDayLabel } from '@/lib/pickOfDay';

// A nap filmje (terv-3 143, Norbi választása: „C” + a „B” sorsolója): az adatlap tetején a szalag („A nap filmje ·
// dátum”, „Másikat”), alatta a sorsoló – a letöltött filmek borítói végigpörögnek, és lassulva megállnak a nap
// filmjén. Utána egy pillanat, a sorsoló összecsukódik, és beúszik az adatlap (a TitleEditor addig rejti:
// data-picking). A „Másikat” újra pörget (spinKey). Kevesebb mozgásnál nincs pörgés, rögtön az eredmény.
const THUMB = 'https://image.tmdb.org/t/p/w185'; // a lista képmérete (a service worker tárolja)
const ROUNDS = 4; // ennyi kör a borítókból; a nyertes az utolsóban
const FACES = 10; // legfeljebb ennyi különböző borító a sorsolóban
const SPIN_MS = 1600;
const SETTLE_MS = 450; // a megállás után ennyit látszik a nyertes, mielőtt összecsukódik

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// a sorsoló borítói: ROUNDS kör, körönként keverve; target: a nyertes helye az utolsó körben
function buildReel(pool, winner) {
  const faces = [winner, ...shuffle(pool.filter((t) => t.id !== winner.id)).slice(0, FACES - 1)];
  const order = [];
  for (let k = 0; k < ROUNDS; k++) order.push(...shuffle(faces));
  const last = faces.length * (ROUNDS - 1);
  return { order, target: last + order.slice(last).findIndex((t) => t.id === winner.id) };
}

const DICE = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
    <path d="M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01" strokeWidth="2.6" />
  </svg>
);

const SHUFFLE = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
  </svg>
);

export default function PickOfDay({ pool, winner, spinKey, hidden, onAnother, onSettled }) {
  const trackRef = useRef(null);
  const [won, setWon] = useState(-1); // a megállt borító helye
  const [done, setDone] = useState(false); // összecsukódott, látszik az adatlap
  // új sorsoló csak „Másikat”-ra (a készlet közbeni változása – pl. megnézettre állítás – nem pörget újra)
  const reel = useMemo(() => buildReel(pool, winner), [spinKey, winner.id]);
  const day = useMemo(pickDayLabel, []);

  useLayoutEffect(() => {
    const track = trackRef.current;
    const faces = track.children;
    setWon(-1);
    setDone(false);
    // a nyertes a sorsoló közepére
    const step = faces[1] ? faces[1].offsetLeft - faces[0].offsetLeft : 0;
    const center = track.parentElement.clientWidth / 2 - faces[0].offsetWidth / 2;
    const at = (i) => `translateX(${center - i * step}px)`;
    let timer;
    const settle = () => {
      setWon(reel.target);
      timer = setTimeout(() => {
        setDone(true);
        onSettled();
      }, reduced() ? 0 : SETTLE_MS);
    };
    if (reduced()) {
      track.style.transform = at(reel.target);
      settle();
      return () => clearTimeout(timer);
    }
    const spin = track.animate([{ transform: at(reel.target - (reel.order.length / ROUNDS) * (ROUNDS - 1)) }, { transform: at(reel.target) }], {
      duration: SPIN_MS,
      easing: 'cubic-bezier(0.12, 0.72, 0.18, 1)',
      fill: 'forwards',
    });
    spin.onfinish = settle;
    return () => {
      spin.onfinish = null;
      spin.cancel();
      track.style.transform = at(reel.target);
      clearTimeout(timer);
    };
  }, [reel]); // az onSettled minden rajzoláskor új – csak új sorsolónál indul újra

  return (
    <section className="potd" aria-label="A nap filmje" hidden={hidden}>
      <div className="potd-ribbon">
        {DICE}
        <b>A nap filmje</b>
        <span className="potd-day">· {day}</span>
        {/* pörgés közben nem tiltott (disabled), csak nem csinál semmit: a fókusz a gombon marad */}
        {pool.length > 1 && (
          <button
            type="button"
            className="ghost potd-another"
            aria-disabled={!done}
            onClick={() => done && onAnother()}
          >
            {SHUFFLE}
            Másikat
          </button>
        )}
      </div>
      <div className="potd-reel" data-done={done ? '' : undefined} aria-hidden="true">
        <div>
          <div className="potd-window">
            <div className="potd-track" ref={trackRef}>
              {reel.order.map((t, i) => (
                <span key={i} className="potd-face" data-won={i === won ? '' : undefined}>
                  {t.poster_path ? <img src={THUMB + t.poster_path} alt="" decoding="async" /> : <span>{t.title}</span>}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {done ? `A nap filmje: ${winner.title}` : 'Sorsolás…'}
      </p>
    </section>
  );
}

function reduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
