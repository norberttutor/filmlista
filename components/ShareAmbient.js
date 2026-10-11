'use client';

import { usePosterColor, ambientProps } from '@/lib/posterColor';

// A megosztott nézési sorrend oldala a franchise színében (terv-3 52.3, Norbi választása: „A”): a
// színt a böngésző számolja a franchise borítójából (shared_watch_order → poster_path, ugyanaz a cím,
// mint az appban), és a <main>-re teszi (--ambient + data-ambient); a CSS csak ilyenkor színez.
export default function ShareAmbient({ posterPath, children }) {
  const { style, ...data } = ambientProps(usePosterColor(posterPath));
  return (
    <main className="share-page" style={style} {...data}>
      {children}
    </main>
  );
}
