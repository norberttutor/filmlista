'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

// A Supabase hibája magyarul: csak a valóban rossz adatra mondjuk, hogy hibás
// (net nélkül / túl sok próbálkozásnál ne a jelszót gyanúsítsa).
function loginErrorText(error) {
  if (error.name === 'AuthRetryableFetchError' || error.status === 0 || !navigator.onLine) {
    return 'Nem sikerült elérni a szervert. Ellenőrizd az internetkapcsolatot, és próbáld újra.';
  }
  if (error.status === 429 || error.code === 'over_request_rate_limit') {
    return 'Túl sok belépési próbálkozás. Várj néhány percet, és próbáld újra.';
  }
  if (error.code === 'invalid_credentials' || error.status === 400) {
    return 'Hibás e-mail-cím vagy jelszó.';
  }
  return 'A belépés most nem sikerült. Próbáld újra néhány perc múlva.';
}

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(loginErrorText(error));
    setBusy(false);
  }

  return (
    <main className="login">
      <h1 className="brand">Megnézendő filmek és sorozatok</h1>
      <form className="login-form" onSubmit={handleSubmit}>
        <label>
          E-mail-cím
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Jelszó
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? 'Belépés…' : 'Belépés'}
        </button>
      </form>
    </main>
  );
}
