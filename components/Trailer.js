'use client';

// Az előzetes gombja és lejátszója (a TitleEditor és Mama adatlapja – MamaDetail – közös része, átnézés J10).
// trailer: a /api/tmdb/videos válaszának video-ja ({ key, lang }); a gomb csak akkor jelenik meg, ha van.
// A lejátszó csak kattintásra töltődik (YouTube, adatkímélő mód); a playing állapot a hívóé (az adatlap
// elhagyott lapján leállítja, és a lejátszó helye is a hívótól függ).

export function TrailerButton({ trailer, playing, onToggle }) {
  if (!trailer) return null;
  return (
    <button type="button" className="ghost trailer-btn" aria-expanded={playing} onClick={onToggle}>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path d={playing ? 'M6 6l12 12M18 6 6 18' : 'M8 5v14l11-7z'} fill={playing ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth={playing ? 2.4 : 0} strokeLinecap="round" />
      </svg>
      {playing ? 'Előzetes bezárása' : 'Előzetes megnézése'}
      {!playing && trailer.lang !== 'hu' && <span className="trailer-lang">angolul</span>}
    </button>
  );
}

export function TrailerPlayer({ trailer, playing, title }) {
  if (!playing || !trailer) return null;
  return (
    <div className="trailer">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0&hl=hu&cc_lang_pref=hu`}
        title={`Előzetes: ${title}`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
