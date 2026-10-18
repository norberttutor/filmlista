'use client';

import { useEffect } from 'react';

// Váratlan hiba magyarul (H3) – az app/error.js és a megosztott oldal error.js-e használja.
// A retry() újra lekéri és kirajzolja a hibás részt; ha az sem segít, a teljes újratöltés.
export default function ErrorScreen({ error, retry, className }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={className}>
      <div className="share-gone error-screen" role="alert">
        <h1>Valami hiba történt</h1>
        <p className="muted">
          Az oldal egy része nem töltődött be. Próbáld újra; ha nem segít, töltsd újra az oldalt.
        </p>
        <div className="error-actions">
          <button type="button" onClick={() => retry()}>
            Újrapróbálás
          </button>
          <button type="button" className="ghost" onClick={() => window.location.reload()}>
            Az oldal újratöltése
          </button>
        </div>
      </div>
    </main>
  );
}
