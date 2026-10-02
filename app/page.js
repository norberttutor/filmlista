'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import LoginForm from '@/components/LoginForm';
import Watchlist from '@/components/Watchlist';
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

  if (session === undefined) {
    return (
      <main className="center">
        <p className="muted">Betöltés…</p>
      </main>
    );
  }

  return (
    <>
      {session ? <Watchlist session={session} /> : <LoginForm />}
      <SiteFooter />
    </>
  );
}
