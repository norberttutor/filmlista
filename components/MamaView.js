'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { signOut } from '@/lib/offline';
import { toast } from '@/lib/toast';
import Toaster from '@/components/Toaster';
import ImdbBadge from '@/components/ImdbBadge';
import MamaDetail from '@/components/MamaDetail';
import ThemeToggle from '@/components/ThemeToggle';
import { useSlidingThumb } from '@/lib/useSlidingThumb';
import { useAppFreshness } from '@/lib/appVersion';
import { reportError } from '@/lib/errorLog';
import Reflow from '@/components/Reflow';
import { bump, flyPoster } from '@/lib/flyPoster';

const POSTER = 'https://image.tmdb.org/t/p/w185';
const PAGE = 5; // a „Filmek” fülön ennyi film látszik egyszerre, utána „További filmek” (+5; Norbi kérése, M1)

// a szűrő (Norbi kérése, 2026-10-07): alapból a még eldöntendők, külön az „Érdekel”-re jelöltek
const TABS = [
  { code: 'open', label: 'Filmek', match: (t) => t.mama_status == null, empty: 'Most nincs új film, amiről kérdeznénk.' },
  { code: 'interested', label: 'Érdekel', match: (t) => t.mama_status === 'interested', empty: 'Még nem jelöltél meg filmet. A „Filmek” közül az „Érdekel” gombbal teheted ide.' },
];

// Mama jelölése a saját függvényével (supabase/17_mama_access.sql): 'interested' / 'declined' / null.
// Címenként sorba állítva: gyors kattintásoknál (jelölés + visszavonás) a kérések sorrendje
// így biztosan az, amit a felület mutat.
const markQueues = new Map();

// a kieső sor mozgása (Reflow exit): „Nem érdekel” – balra kiúszik; „Érdekel” – elhalványul (a borítója közben a
// fülhöz repül)
const EXITS = {
  declined: {
    keyframes: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-2.5rem)' }],
    timing: { duration: 240 },
  },
  interested: {
    keyframes: [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.97)' }],
    timing: { duration: 220, easing: 'ease-out' },
  },
};

async function sendMark(id, choice) {
  let error;
  try {
    ({ error } = await supabase.rpc('mama_mark', { p_title_id: id, p_choice: choice }));
  } catch (err) {
    error = err;
  }
  if (error) {
    reportError(error);
    throw new Error('Nem sikerült menteni. Ellenőrizd az internetkapcsolatot, és próbáld újra.');
  }
}

function mamaMark(id, choice) {
  const run = (markQueues.get(id) ?? Promise.resolve()).catch(() => {}).then(() => sendMark(id, choice));
  markQueues.set(id, run);
  const done = () => markQueues.get(id) === run && markQueues.delete(id);
  run.then(done, done);
  return run;
}

// Mama oldala (terv-3 13, Norbi választása: „B” látványterv – munka/terv-3/terv-13/): Norbi
// listájából a mama_list() filmjei (franchise nélküli, megnézendő, jelöletlen, már megjelent + az
// „Érdekli”-k a Megkaptáig), a legutóbb hozzáadott elöl; szűrő: „Filmek” (jelöletlen, alapból) /
// „Érdekel”. Soronként borító, cím, év, műfaj, IMDb, leírás és a két gomb; a sorra kattintva az
// adatlap (MamaDetail). A „Filmek” fülön egyszerre 5 film (M1): az „Érdekel” és a „Nem érdekel” is
// leveszi a sort (az adatlapot is zárja), a helyére jön a következő, az értesítősávban „Visszavonás”.
// Az „Érdekel” fül egyben mutat mindent; ott a „✓ Érdekel” újra kattintva visszavonható – a sor
// ezért a fül váltásáig a helyén marad (kept).
// A sor elköltözik (terv-3 136): jelöléskor és visszavonáskor a sorok a helyükre csúsznak (Reflow; a fülváltásnál
// nem) – „Érdekel”-re a borító az „Érdekel” fül számához repül (az dobban), „Nem érdekel”-re a sor balra kiúszik.
export default function MamaView() {
  const [list, setList] = useState(null); // null: tölt
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('open');
  const tabsThumb = useSlidingThumb(); // csúszó kijelölő a füleken (terv-3 100)
  const [kept, setKept] = useState(() => new Set());
  const [shown, setShown] = useState(PAGE);
  const [openId, setOpenId] = useState(null);
  const [moves, setMoves] = useState(0); // jelölésenként nő: a Reflow ekkor mozgatja a sorokat
  const rowsRef = useRef(null);
  const exits = useRef(new Map()); // a kieső sor mozgása (címazonosító → 'declined' | 'interested')
  const move = (id, how) => {
    if (how) exits.current.set(String(id), how);
    setMoves((n) => n + 1);
  };
  const exit = (key) => EXITS[exits.current.get(key)];
  // „Érdekel”: a sor borítója az „Érdekel” fül számához repül, az dobban
  const flyToInterested = (item) => {
    const to = document.querySelector('.mama-tabs [data-tab="interested"] .n');
    const from = rowsRef.current?.querySelector(`[data-flip="${item.id}"] .mama-poster img`);
    flyPoster({ from, src: item.poster_path && POSTER + item.poster_path, to, lift: 70 }).then(() => bump(to));
  };

  function pickTab(code) {
    setTab(code);
    setKept(new Set());
    setShown(PAGE);
  }

  // silent: csendes újratöltés (visszatéréskor) – hibánál a meglévő lista marad, hibasáv nélkül
  async function load(silent = false) {
    if (!silent) setLoadError('');
    const { data, error } = await supabase.rpc('mama_list');
    if (error) {
      reportError(error);
      if (!silent) setLoadError('Nem sikerült betölteni a filmeket. Ellenőrizd az internetkapcsolatot, és próbáld újra.');
      return;
    }
    // menet közbeni jelölésnél a szerver még a régit adhatná: a felület marad, ahogy van
    if (silent && markQueues.size > 0) return;
    setList(data);
  }

  useEffect(() => {
    load();
  }, []);

  // napokig nyitva hagyott lapon is friss (átnézés J13): legalább 5 perc távollét után visszatérve
  // csendben újratölt (a fül, a „További filmek” és a kept marad), új kiadásnál „Frissült az app” sáv
  useAppFreshness(list != null && !loadError, () => load(true));

  const setStatus = (id, status) => setList((l) => l.map((t) => (t.id === id ? { ...t, mama_status: status } : t)));

  // fromDetail: az adatlapról (MamaDetail) – ha az még nyitva, a hibát az mutatja helyben (B16: az értesítősáv a
  // nyitott ablak mögött nem látszik); a „Nem érdekel” és a „Filmek” fülön az „Érdekel” bezárja, ott marad a sáv
  async function mark(item, choice, fromDetail = false) {
    const previous = item.mama_status;
    if (choice === 'declined') {
      // a sor eltűnik (a helyét megjegyezve, hogy a visszavonás oda tegye vissza)
      const index = list.findIndex((t) => t.id === item.id);
      move(item.id, 'declined');
      setList((l) => l.filter((t) => t.id !== item.id));
      if (openId === item.id) setOpenId(null);
      try {
        await mamaMark(item.id, 'declined');
      } catch (err) {
        setList((l) => [...l.slice(0, index), item, ...l.slice(index)]);
        toast({ text: err.message });
        return;
      }
      toast({
        text: `„${item.title}” – nem érdekel.`,
        action: {
          label: 'Visszavonás',
          onClick: async () => {
            try {
              await mamaMark(item.id, previous);
              move();
              setList((l) => [...l.slice(0, index), item, ...l.slice(index)]);
            } catch (err) {
              toast({ text: err.message });
            }
          },
        },
      });
      return;
    }
    if (tab === 'open' && choice === 'interested') {
      flyToInterested(item);
      move(item.id, 'interested');
    }
    setStatus(item.id, choice);
    if (tab === 'open' && choice === 'interested') {
      // a „Filmek” fülről a sor átkerül az „Érdekel” fülre (a helyére a következő jön)
      if (openId === item.id) setOpenId(null);
      try {
        await mamaMark(item.id, choice);
      } catch (err) {
        setStatus(item.id, previous);
        toast({ text: err.message });
        return;
      }
      toast({
        text: `„${item.title}” – érdekel.`,
        action: {
          label: 'Visszavonás',
          onClick: async () => {
            try {
              await mamaMark(item.id, previous);
              move();
              setStatus(item.id, previous);
              bump(document.querySelector('.mama-tabs [data-tab="interested"] .n'));
            } catch (err) {
              toast({ text: err.message });
            }
          },
        },
      });
      return;
    }
    setKept((k) => new Set(k).add(item.id));
    try {
      await mamaMark(item.id, choice);
    } catch (err) {
      setStatus(item.id, previous);
      if (fromDetail && document.querySelector('dialog.mama-detail[open]')) throw err;
      toast({ text: err.message });
    }
  }

  const opened = list?.find((t) => t.id === openId);
  const current = TABS.find((x) => x.code === tab);
  const visible = list ? list.filter((t) => current.match(t) || kept.has(t.id)) : [];
  const limit = tab === 'open' ? shown : visible.length; // az „Érdekel” fül egyben

  return (
    <main className="mama-page">
      <header className="mama-head">
        <div>
          <h1>Norbi filmjei</h1>
          <p>Jelöld meg, melyik érdekel – a filmre kattintva többet is megtudhatsz róla.</p>
        </div>
        {/* világos / sötét téma (terv-3 50): Mamánál felirattal, az alapja a világos */}
        <div className="mama-head-actions">
          <ThemeToggle labeled />
          <button type="button" className="ghost" onClick={signOut}>
            Kilépés
          </button>
        </div>
      </header>

      {list && !loadError && (
        <div className="mama-tabs sliding" ref={tabsThumb} role="group" aria-label="Szűrés">
          {TABS.map((x) => (
            <button
              key={x.code}
              type="button"
              className="chip"
              data-tab={x.code}
              aria-pressed={tab === x.code}
              onClick={() => pickTab(x.code)}
            >
              {x.label}
              <span className="n">{list.filter(x.match).length}</span>
            </button>
          ))}
        </div>
      )}

      {loadError ? (
        <div className="mama-empty">
          <p role="alert">{loadError}</p>
          <button type="button" className="ghost" onClick={() => load()}>
            Újrapróbálás
          </button>
        </div>
      ) : list === null ? (
        <p className="muted mama-empty">Betöltés…</p>
      ) : visible.length === 0 ? (
        <p className="mama-empty">{current.empty}</p>
      ) : (
        <>
          <Reflow trigger={moves} boxRef={rowsRef} exit={exit}>
            <ul className="mama-rows" ref={rowsRef}>
              {visible.slice(0, limit).map((t) => {
                const yes = t.mama_status === 'interested';
                return (
                  <li key={t.id} data-flip={t.id} className={yes ? 'interested' : undefined}>
                    <button type="button" className="mama-open" onClick={() => setOpenId(t.id)} aria-label={`${t.title} adatlapja`}>
                      <span className="mama-poster">{t.poster_path && <img src={POSTER + t.poster_path} alt="" loading="lazy" />}</span>
                    </button>
                    <div className="mama-text">
                      <h2>
                        <button type="button" className="mama-title" onClick={() => setOpenId(t.id)}>
                          {t.title}
                        </button>
                      </h2>
                      <p className="mama-meta">
                        {[t.release_year, (t.genres ?? []).slice(0, 3).join(' · ')].filter(Boolean).join(' · ')}
                        <ImdbBadge title={t} />
                      </p>
                      {t.overview && <p className="mama-overview">{t.overview}</p>}
                    </div>
                    <div className="mama-buttons">
                      <button
                        type="button"
                        className="mama-btn yes"
                        aria-pressed={yes}
                        onClick={() => mark(t, yes ? null : 'interested')}
                      >
                        {yes ? '✓ Érdekel' : 'Érdekel'}
                      </button>
                      <button type="button" className="mama-btn" onClick={() => mark(t, 'declined')}>
                        Nem érdekel
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Reflow>
          {visible.length > limit && (
            <button type="button" className="ghost mama-more" onClick={() => setShown((n) => n + PAGE)}>
              További filmek
            </button>
          )}
        </>
      )}

      {opened && <MamaDetail item={opened} onMark={(t, choice) => mark(t, choice, true)} onClose={() => setOpenId(null)} />}
      <Toaster />
    </main>
  );
}
