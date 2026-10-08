'use client';

import { setTheme, useTheme } from '@/lib/theme';

// A téma váltógombja (terv-3 50): sötétben nap (világosra vált), világosban hold (sötétre vált).
// Norbinál kerek ikongomb a ⋮ menü előtt (a súgó és a felolvasó neve: „Világos téma” / „Sötét téma”);
// Mama oldalán (labeled) felirattal a „Kilépés” előtt: „Világos” / „Sötét”.
export default function ThemeToggle({ labeled = false }) {
  const theme = useTheme();
  const next = theme === 'light' ? 'dark' : 'light';
  const label = next === 'light' ? 'Világos téma' : 'Sötét téma';
  const icon =
    next === 'light' ? (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
      </svg>
    );

  if (labeled) {
    return (
      <button type="button" className="ghost theme-toggle-labeled" aria-label={label} title={label} onClick={() => setTheme(next)}>
        {icon}
        <span>{next === 'light' ? 'Világos' : 'Sötét'}</span>
      </button>
    );
  }
  return (
    <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={() => setTheme(next)}>
      {icon}
    </button>
  );
}
