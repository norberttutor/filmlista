import { genreColor } from '@/lib/genreColors';

// Műfajikon (terv-3 56, Norbi választása: „A”): egyvonalas rajz a műfaj színében – ugyanaz a szín, mint a
// műfaj pöttye a listában (genreColor); világos témában ugyanez az árnyalat mélyebben (CSS: .genre-icon).
// A kulcs a TMDB magyar műfajneve (a sorozatoké részben angol); ismeretlen műfajnál egy pötty.
const PATHS = {
  Akció: 'M13 2 4 14h7l-1 8 9-12h-7z',
  'Action & Adventure': 'M13 2 4 14h7l-1 8 9-12h-7z',
  Kaland: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M15.5 8.5l-2 5-5 2 2-5z',
  Animációs: 'M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z',
  Vígjáték: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M8 14s1.5 2 4 2 4-2 4-2 M9 9.5h.01 M15 9.5h.01',
  Bűnügyi: 'M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M14.5 14.5 20 20',
  Dokumentum: 'M3 7h12v10H3z M15 10.5l6-3v9l-6-3',
  Dráma: 'M4 5h7v6a3.5 3.5 0 0 1-7 0z M13 9h7v6a3.5 3.5 0 0 1-7 0z M6 8h.01 M9 8h.01 M15 12h.01 M18 12h.01',
  Családi: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-5h4v5',
  Gyerek: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-5h4v5',
  Fantasy: 'M4 20 15 9 M14 3v3 M19 8h3 M17.5 5.5 19.5 3.5 M10 4l.5 1.5L12 6l-1.5.5L10 8l-.5-1.5L8 6l1.5-.5z',
  Történelmi: 'M4 21h16 M5 18h14 M6.5 18V10 M10.5 18V10 M13.5 18V10 M17.5 18V10 M3 10l9-6 9 6z',
  Horror: 'M5 21V11a7 7 0 0 1 14 0v10l-2.3-1.8-2.3 1.8-2.4-1.8-2.4 1.8-2.3-1.8z M9.5 11h.01 M14.5 11h.01',
  Zenei: 'M9 18V5l11-2v13 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  Rejtély: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M9.5 9.2a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.5 M12 16.5h.01',
  Romantikus: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  Szappanopera: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  'Sci-Fi': 'M12 15c-2-2-3-5-3-8 0-2 1.5-4 3-5 1.5 1 3 3 3 5 0 3-1 6-3 8z M9 11.5l-3 3v3l3-2 M15 11.5l3 3v3l-3-2 M12 18v3',
  'Sci-Fi & Fantasy': 'M12 15c-2-2-3-5-3-8 0-2 1.5-4 3-5 1.5 1 3 3 3 5 0 3-1 6-3 8z M9 11.5l-3 3v3l3-2 M15 11.5l3 3v3l-3-2 M12 18v3',
  'TV film': 'M3 7h18v12H3z M8 3l4 4 4-4',
  Thriller: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  Háborús: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  'War & Politics': 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  Western: 'M12 21V5a2 2 0 0 1 4 0v8 M12 13H9a2 2 0 0 1-2-2V8 M16 10h1a2 2 0 0 0 2-2V7 M7 21h10',
  Hírek: 'M4 5h13v14H6a2 2 0 0 1-2-2z M17 9h3v8a2 2 0 0 1-2 2 M7 9h7 M7 13h7',
  Reality: 'M3 7h12v10H3z M15 10.5l6-3v9l-6-3',
  Talk: 'M4 5h16v11H9l-5 4z',
};
const DOT = 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z';

export default function GenreIcon({ name }) {
  return (
    <span className="genre-icon" style={{ '--g': genreColor(name) }} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={PATHS[name] ?? DOT} />
      </svg>
    </span>
  );
}
