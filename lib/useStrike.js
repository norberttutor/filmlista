import { useEffect, useState } from 'react';
import { afterDialogs } from '@/lib/afterDialogs';

// Kihúzás (terv-3 40): hányszor vált a cím (vagy a nézési sorrend tétele) megnézettre, amióta
// látszik. A számláló a .strike span kulcsa és jelzője: váltáskor a span újraépül, a CSS-animáció
// (egy zöld vonal végigfut a címen) újraindul; betöltéskor és újrarajzoláskor nem fut.
// Nyitott ablaknál (a kártya az adatlap mögött van) a bezárásáig vár – addig a mozgás nem látszana (terv-3 133).
export function useStrike(status) {
  const [seen, setSeen] = useState({ status, n: 0, pending: false });
  if (seen.status !== status) setSeen({ status, n: seen.n, pending: status === 'watched' });
  const pending = seen.pending;
  useEffect(() => {
    if (!pending) return;
    return afterDialogs(() => setSeen((s) => (s.pending ? { ...s, n: s.n + 1, pending: false } : s)));
  }, [pending]);
  return seen.n;
}

// Kifolyik a szín (terv-3 133): a kihúzással együtt a borító színes másolata balról jobbra elfogy (36-mozgas.css,
// .drain-copy), alatta már a megnézett, szürke borító. n: a useStrike számlálója; igaz, amíg a mozgás tart.
const DRAIN_MS = 700;

export function useDrain(n) {
  const [done, setDone] = useState(0);
  const draining = n > done;
  useEffect(() => {
    if (!draining) return;
    const timer = setTimeout(() => setDone(n), DRAIN_MS);
    return () => clearTimeout(timer);
  }, [draining, n]);
  return draining;
}
