'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoginForm from '@/components/LoginForm';
import Watchlist from '@/components/Watchlist';
import MamaView from '@/components/MamaView';
import SiteFooter from '@/components/SiteFooter';

export default function Home() {
  // undefined = még nem tudjuk, be vagy-e lépve
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // néző-e (terv-3 13): akinek van sora a list_viewers-ben (Mama), a saját oldalát látja, nem a
  // listát. undefined: még nem tudjuk; hibánál a lista nyílik (a néző ott csak a saját üres adatait
  // látná – az RLS védi Norbiét)
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
        if (!cancelled) setViewer({ userId, row: error ? null : data });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const viewerRow = viewer.userId === userId ? viewer.row : undefined;

  if (session === undefined || (session && viewerRow === undefined)) {
    return (
      <main className="center">
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
