'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { clearSnapshots, registerServiceWorker, storedSession } from '@/lib/offline';
import LoginForm from '@/components/LoginForm';
import Watchlist from '@/components/Watchlist';
import MamaView from '@/components/MamaView';
import SiteFooter from '@/components/SiteFooter';

// néző-e (terv-3 13) – a böngésző megjegyzi, így a következő indításkor nem kell rá várni (és net
// nélkül is tudja); a lekérdezés a háttérben megerősíti
const VIEWER_KEY = 'filmlista-nezo:';

function cachedViewer(userId) {
  try {
    const v = localStorage.getItem(VIEWER_KEY + userId);
    return v === null ? undefined : v === '1' ? {} : null;
  } catch {
    return undefined;
  }
}

function rememberViewer(userId, row) {
  try {
    localStorage.setItem(VIEWER_KEY + userId, row ? '1' : '0');
  } catch {
    // így csak most érvényes
  }
}

export default function Home() {
  // undefined = még nem tudjuk, be vagy-e lépve
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    registerServiceWorker(); // offline indulás (terv-3 44)

    // net nélkül, lejárt tokennel a getSession() nem ad munkamenetet (nem tudja megújítani – és
    // addig sokáig újrapróbálja), de a tárolt munkamenettel a helyben mentett lista megmutatható
    // (csak olvasható; offline: true). Ha visszajön a net, újra kérjük: a Supabase megújítja a tokent.
    const storedOffline = () => {
      const stored = storedSession(supabase.auth.storageKey);
      return stored ? { ...stored, offline: true } : null;
    };
    const resolve = ({ data, error }) => {
      if (data.session) return setSession(data.session);
      const offline = !navigator.onLine || error?.name === 'AuthRetryableFetchError';
      setSession(offline ? storedOffline() : null);
    };
    supabase.auth.getSession().then(resolve);
    // ha a válasz késik (nincs net / akadozik): addig a tárolt munkamenet, a válasz később leváltja
    const slow = setTimeout(
      () => setSession((cur) => (cur === undefined ? (storedOffline() ?? undefined) : cur)),
      navigator.onLine ? 4000 : 300
    );

    const { data } = supabase.auth.onAuthStateChange((event, newSession) => {
      // kilépéskor a helyben tárolt lista is törlődik
      if (event === 'SIGNED_OUT') clearSnapshots();
      // a net nélküli munkamenetet csak a valódi kilépés vagy egy új munkamenet váltja le
      setSession((cur) => (!newSession && cur?.offline && event !== 'SIGNED_OUT' ? cur : newSession));
    });
    const retry = () => supabase.auth.getSession().then(resolve);
    window.addEventListener('online', retry);
    return () => {
      clearTimeout(slow);
      data.subscription.unsubscribe();
      window.removeEventListener('online', retry);
    };
  }, []);

  // néző-e (terv-3 13): akinek van sora a list_viewers-ben (Mama), a saját oldalát látja, nem a
  // listát. undefined: még nem tudjuk; hibánál a megjegyzett érték, ha nincs, a lista nyílik (a
  // néző ott csak a saját üres adatait látná – az RLS védi Norbiét)
  const userId = session?.user?.id;
  const [viewer, setViewer] = useState({ userId: null, row: undefined });
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('list_viewers')
      .select('owner_id')
      .eq('viewer_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('Néző ellenőrzése:', error.message);
        else rememberViewer(userId, data);
        if (!cancelled) setViewer({ userId, row: error ? (cachedViewer(userId) ?? null) : data });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const viewerRow = !userId ? undefined : viewer.userId === userId ? viewer.row : cachedViewer(userId);

  if (session === undefined || (session && viewerRow === undefined)) {
    return (
      <main className="center" data-list="loading">
        <p className="muted">Betöltés…</p>
      </main>
    );
  }

  return (
    <>
      {!session ? <LoginForm /> : viewerRow ? <MamaView /> : <Watchlist session={session} />}
      <SiteFooter />
    </>
  );
}
