import { useState } from 'react';

// Kihúzás (terv-3 40): hányszor vált a cím (vagy a nézési sorrend tétele) megnézettre, amióta
// látszik. A számláló a .strike span kulcsa és jelzője: váltáskor a span újraépül, a CSS-animáció
// (egy zöld vonal végigfut a címen) újraindul; betöltéskor és újrarajzoláskor nem fut.
export function useStrike(status) {
  const [seen, setSeen] = useState({ status, n: 0 });
  if (seen.status !== status) setSeen({ status, n: seen.n + (status === 'watched' ? 1 : 0) });
  return seen.n;
}
