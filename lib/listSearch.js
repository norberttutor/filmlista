// Keresés a listán (terv-3 66): a címben, az eredeti címben és a franchise nevében; ha a teljes listán egy
// szóra sincs pontos találat, egy betűnyi elírást elnéz (5+ betűs szóban, Damerau–Levenshtein ≤ 1).
// Kis- / nagybetű és ékezet nem számít (fold).

export const fold = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const FUZZY_MIN = 5; // ennél rövidebb szóban nem javítunk (túl sok lenne a téves találat)

// egy betű cseréje, kihagyása, beszúrása vagy két szomszédos felcserélése (optimal string alignment)
function withinOne(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const rest = (x, y) => a.slice(x) === b.slice(y);
  if (a.length === b.length)
    return rest(i + 1, i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && rest(i + 2, i + 2));
  return a.length > b.length ? rest(i + 1, i) : rest(i, i + 1);
}

// címenként a kereshető szöveg: { text: cím + eredeti cím, fr: a franchise neve } (mind fold-olva)
export function searchIndex(titles, franchiseName) {
  return new Map(
    titles.map((t) => [
      t.id,
      {
        raw: `${t.title} ${t.original_title ?? ''} ${t.franchise_id != null ? (franchiseName.get(t.franchise_id) ?? '') : ''}`,
        text: fold(`${t.title} ${t.original_title ?? ''}`),
        fr: t.franchise_id != null ? fold(franchiseName.get(t.franchise_id) ?? '') : '',
      },
    ])
  );
}

// a keresés szavai a teljes listán: { words, corrected } – ha valamelyik szóra sehol nincs pontos találat,
// és mind javítható egy betűvel, a javított szavak (corrected: [{ from, to, label }] – a label a szó
// eredeti, ékezetes alakja kisbetűvel, a kiíráshoz); különben a beírtak
export function resolveWords(words, index) {
  const all = [...index.values()];
  const hit = (w) => all.some((x) => x.text.includes(w) || x.fr.includes(w));
  if (!words.length || words.every(hit)) return { words, corrected: [] };
  const vocab = new Map(); // fold-olt szó → az eredeti alakja
  for (const x of all)
    for (const tok of x.raw.split(/[^\p{L}\p{N}]+/u)) if (tok && !vocab.has(fold(tok))) vocab.set(fold(tok), tok.toLowerCase());
  const corrected = [];
  const out = [];
  for (const w of words) {
    if (hit(w)) {
      out.push(w);
      continue;
    }
    if (w.length < FUZZY_MIN) return { words, corrected: [] };
    // a teljes szóval vagy (gépelés közben) az ugyanolyan hosszú elejével egyezzen egy betű eltéréssel
    let best = null;
    for (const [tok, orig] of vocab) {
      const whole = withinOne(w, tok);
      if (!whole && !(tok.length > w.length && withinOne(w, tok.slice(0, w.length)))) continue;
      const to = whole ? tok : tok.slice(0, w.length);
      if (!best || to.length < best.to.length) best = { to, label: whole ? orig : [...orig].slice(0, w.length).join('') };
    }
    if (!best) return { words, corrected: [] };
    out.push(best.to);
    corrected.push({ from: w, ...best });
  }
  return { words: out, corrected };
}

// illik-e a cím: minden szónak szerepelnie kell a címben / eredeti címben vagy a franchise nevében;
// byFranchise: volt-e szó, ami csak a franchise nevében szerepelt
export function matchTitle(words, entry) {
  let byFranchise = false;
  for (const w of words) {
    if (entry.text.includes(w)) continue;
    if (entry.fr.includes(w)) byFranchise = true;
    else return null;
  }
  return { byFranchise };
}

// a szöveg darabjai a kiemeléshez: [{ text, hit }] – a fold karakterenként történik, így a találat
// helye az eredeti (ékezetes) szövegben is pontos
export function highlightParts(text, words) {
  if (!text || !words?.length) return [{ text, hit: false }];
  const chars = [...text];
  let folded = '';
  const start = []; // a fold-olt szöveg minden karakteréhez: az eredeti karakter indexe
  chars.forEach((c, i) => {
    const f = fold(c);
    for (let k = 0; k < f.length; k++) start.push(i);
    folded += f;
  });
  const mark = new Array(chars.length).fill(false);
  for (const w of words) {
    let from = 0;
    for (let at = folded.indexOf(w, from); at !== -1 && w; at = folded.indexOf(w, from)) {
      for (let k = at; k < at + w.length; k++) mark[start[k]] = true;
      from = at + w.length;
    }
  }
  const parts = [];
  chars.forEach((c, i) => {
    const last = parts[parts.length - 1];
    if (last && last.hit === mark[i]) last.text += c;
    else parts.push({ text: c, hit: mark[i] });
  });
  return parts;
}
