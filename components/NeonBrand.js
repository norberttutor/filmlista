'use client';

import { useEffect, useState } from 'react';

// Neonfelirat a fejlécben (D9, Norbi választása a látványterv után, 2026-10-19 – „Neon – Bricolage”,
// https://claude.ai/artifact/VzCx6F4njpfmNG7FvuUnp5): a cím neoncső. A szöveg maga a kikapcsolt üvegcső,
// fölötte az égő réteg (::after, data-text – így a cím szövege és a felolvasó neve nem duplázódik); a fény a
// „falra” is vetül (::before). Munkamenetenként egyszer felvillan (neon-on; „kevesebb mozgás”-nál rögtön ég).
// A színek: --neon-1 / --neon-2 (app/styles/01-szinek.css, világos / téka: 02-, 03-).
const FLICKER_KEY = 'filmlista-neon';

export default function NeonBrand() {
  const [flicker, setFlicker] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(FLICKER_KEY)) return;
      sessionStorage.setItem(FLICKER_KEY, '1');
    } catch {
      return;
    }
    setFlicker(true);
  }, []);

  return (
    <h1 className={`brand neon${flicker ? ' neon-on' : ''}`}>
      <span className="neon-line" data-text="Megnézendő filmek">
        Megnézendő filmek
      </span>{' '}
      <span className="neon-line l2" data-text="és sorozatok">
        és sorozatok
      </span>
    </h1>
  );
}
