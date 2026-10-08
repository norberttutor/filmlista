'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/toast';
import Toaster from '@/components/Toaster';
import ImdbBadge from '@/components/ImdbBadge';
import MamaDetail from '@/components/MamaDetail';
import ThemeToggle from '@/components/ThemeToggle';

const POSTER = 'https://image.tmdb.org/t/p/w185';
const PAGE = 24; // ennyi film látszik, utána „További filmek”

// a szűrő (Norbi kérése, 2026-10-07): alapból a még eldöntendők, külön az „Érdekel”-re jelöltek
const TABS = [
  { code: 'open', label: 'Filmek', match: (t) => t.mama_status == null, empty: 'Most nincs új film, amiről kérdeznénk.' },
  { code: 'interested', label: 'Érdekel', match: (t) => t.mama_status === 'interested', empty: 'Még nem jelöltél meg filmet. A „Filmek” közül az „Érdekel” gombbal teheted ide.' },
];

// Mama jelölése a saját függvényével (supabase/17_mama_access.sql): 'interested' / 'declined' / null
async function mamaMark(id, choice) {
  const { error } = await supabase.rpc('mama_mark', { p_title_id: id, p_choice: choice });
  if (error) {
    console.error(error);
    throw new Error(`Nem sikerült menteni: ${error.message} Próbáld újra.`);
  }
}

// Mama oldala (terv-3 13, Norbi választása: „B” látványterv – munka/terv-3/terv-13/): Norbi
// listájából a mama_list() filmjei (franchise nélküli, megnézendő, jelöletlen, már megjelent + az
// „Érdekli”-k a Megkaptáig), a legutóbb hozzáadott elöl; szűrő: „Filmek” (jelöletlen, alapból) /
// „Érdekel”. Soronként borító, cím, év, műfaj, IMDb, leírás és a két gomb; a sorra kattintva az
// adatlap (MamaDetail). „Nem érdekel” → a sor eltűnik, az értesítősávban „Visszavonás”; az „Érdekel”
// újra kattintva visszavonható – a jelölt sor ezért a szűrő váltásáig a helyén marad (kept).
export default function MamaView() {
  const [list, setList] = useState(null); // null: tölt
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('open');
  const [kept, setKept] = useState(() => new Set());
  const [shown, setShown] = useState(PAGE);
  const [openId, setOpenId] = useState(null);

  function pickTab(code) {
    setTab(code);
    setKept(new Set());
    setShown(PAGE);
  }

  async function load() {
    setLoadError('');
    const { data, error } = await supabase.rpc('mama_list');
    if (error) {
      console.error(error);
      setLoadError('Nem sikerült betölteni a filmeket. Ellenőrizd az internetkapcsolatot, és próbáld újra.');
      return;
    }
    setList(data);
  }

  useEffect(() => {
    load();
  }, []);

  const setStatus = (id, status) => setList((l) => l.map((t) => (t.id === id ? { ...t, mama_status: status } : t)));

  async function mark(item, choice) {
    const previous = item.mama_status;
    if (choice === 'declined') {
      // a sor eltűnik (a helyét megjegyezve, hogy a visszavonás oda tegye vissza)
      const index = list.findIndex((t) => t.id === item.id);
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
              setList((l) => [...l.slice(0, index), item, ...l.slice(index)]);
            } catch (err) {
              toast({ text: err.message });
            }
          },
        },
      });
      return;
    }
    setStatus(item.id, choice);
    setKept((k) => new Set(k).add(item.id));
    try {
      await mamaMark(item.id, choice);
    } catch (err) {
      setStatus(item.id, previous);
      toast({ text: err.message });
    }
  }

  const opened = list?.find((t) => t.id === openId);
  const current = TABS.find((x) => x.code === tab);
  const visible = list ? list.filter((t) => current.match(t) || kept.has(t.id)) : [];

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
          <button type="button" className="ghost" onClick={() => supabase.auth.signOut()}>
            Kilépés
          </button>
        </div>
      </header>

      {list && !loadError && (
        <div className="mama-tabs" role="group" aria-label="Szűrés">
          {TABS.map((x) => (
            <button key={x.code} type="button" className="chip" aria-pressed={tab === x.code} onClick={() => pickTab(x.code)}>
              {x.label}
              <span className="n">{list.filter(x.match).length}</span>
            </button>
          ))}
        </div>
      )}

      {loadError ? (
        <div className="mama-empty">
          <p role="alert">{loadError}</p>
          <button type="button" className="ghost" onClick={load}>
            Újra
          </button>
        </div>
      ) : list === null ? (
        <p className="muted mama-empty">Betöltés…</p>
      ) : visible.length === 0 ? (
        <p className="mama-empty">{current.empty}</p>
      ) : (
        <>
          <ul className="mama-rows">
            {visible.slice(0, shown).map((t) => {
              const yes = t.mama_status === 'interested';
              return (
                <li key={t.id} className={yes ? 'interested' : undefined}>
                  <button type="button" className="mama-open" onClick={() => setOpenId(t.id)} aria-label={`${t.title} – részletek`}>
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
          {visible.length > shown && (
            <button type="button" className="ghost mama-more" onClick={() => setShown((n) => n + PAGE)}>
              További filmek
            </button>
          )}
        </>
      )}

      {opened && <MamaDetail item={opened} onMark={mark} onClose={() => setOpenId(null)} />}
      <Toaster />
    </main>
  );
}
