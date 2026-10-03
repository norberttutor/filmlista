// Tömeges import: soronként egy cím. A sor végi évszám szűr (pl. "Dűne 2021", "Dűne (2021)");
// ami évnek túl nagy (pl. "Szárnyas fejvadász 2049"), az a cím része marad.

export const MAX_LINES = 150; // egyszerre ennyi sor (a TMDB-keresések száma miatt)

// összehasonlításhoz: kis- és nagybetű, ékezet és írásjelek nélkül ("Dűne:" = "dune")
const norm = (s) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

// [{ line, query, year }] – üres és ismétlődő sorok nélkül
export function parseLines(text) {
  const maxYear = new Date().getFullYear() + 5;
  const seen = new Set();
  const entries = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/\s+/g, ' ');
    const key = norm(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    let query = line;
    let year = null;
    const m = line.match(/^(.*?)[\s,–-]*\(?((?:19|20)\d{2})\)?$/);
    if (m && m[1].trim() && Number(m[2]) <= maxYear) {
      query = m[1].trim();
      year = Number(m[2]);
    }
    entries.push({ line, query, year });
  }
  return entries;
}

export const resultKey = (r) => `${r.media_type}:${r.tmdb_id}`;

// Egy sor találatai (a /api/tmdb/search válasza) → { status, candidates, choice }
//   sure:   egyetlen pontos cím-egyezés (évszámmal megadva az évnek is egyeznie kell) –
//           előre kiválasztva
//   unsure: van találat, de nem egyértelmű – választani kell (alapból kihagyás)
//   onList: a biztos találat már a listán van – kimarad
//   none:   nincs találat
// A jelöltek (legfeljebb 5): a pontos cím és az évszám-egyezés előre, egyébként a TMDB sorrendje.
export function matchEntry(entry, results, existingKeys) {
  const q = norm(entry.query);
  const sameTitle = (r) => norm(r.title) === q || norm(r.original_title) === q;
  const sameYear = (r) => entry.year != null && r.release_year === entry.year;

  const ranked = results
    .map((r, i) => ({ r, i, score: (sameTitle(r) ? 2 : 0) + (sameYear(r) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((x) => x.r);
  const candidates = ranked
    .slice(0, 5)
    .map((r) => ({ ...r, key: resultKey(r), onList: existingKeys.has(resultKey(r)) }));
  if (candidates.length === 0) return { status: 'none', candidates, choice: null };

  const exact = results.filter((r) => sameTitle(r) && (entry.year == null || sameYear(r)));
  if (exact.length === 1) {
    const key = resultKey(exact[0]);
    if (existingKeys.has(key)) return { status: 'onList', candidates, choice: null, match: key };
    return { status: 'sure', candidates, choice: key };
  }
  return { status: 'unsure', candidates, choice: null };
}
