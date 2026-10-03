// Műfajszínek: minden műfaj egy árnyalatot kap (OKLCH: egyforma világosság, így mind egyformán
// jól látszik a sötét háttéren). A rokon műfajok rokon színt kapnak. A kulcs a TMDB magyar
// műfajneve (a titles_with_genres nézet a neveket adja). Ismeretlen műfaj: szürke.
const GENRE_HUES = {
  Akció: [32, 0.16],
  'Action & Adventure': [45, 0.15],
  Bűnügyi: [55, 0.11],
  Western: [65, 0.07],
  Kaland: [75, 0.14],
  Történelmi: [88, 0.07],
  Vígjáték: [100, 0.15],
  Háborús: [118, 0.07],
  'War & Politics': [118, 0.07],
  Családi: [135, 0.14],
  Dokumentum: [160, 0.07],
  'Sci-Fi': [238, 0.13],
  'Sci-Fi & Fantasy': [250, 0.12],
  Rejtély: [265, 0.11],
  Thriller: [280, 0.13],
  Horror: [298, 0.14],
  Dráma: [300, 0.05],
  Fantasy: [315, 0.13],
  Zenei: [332, 0.15],
  Animációs: [348, 0.15],
  Romantikus: [10, 0.13],
};

export function genreColor(name) {
  const [hue, chroma] = GENRE_HUES[name] ?? [0, 0];
  return `oklch(0.78 ${chroma} ${hue})`;
}
