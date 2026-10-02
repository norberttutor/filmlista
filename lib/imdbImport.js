// IMDb értékelés-export (CSV) feldolgozása a böngészőben.
// Az IMDb exportjának oszlopai: Const (tt…), Your Rating (1–10), Date Rated, Title, …

// Egyszerű CSV-olvasó: idézőjeles mezők (vesszővel, "" escape-pel, sortöréssel) is.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

// Map: IMDb ID → saját értékelés (1–10). Hibás fájlnál magyar üzenettel dob.
export function parseImdbRatings(text) {
  const rows = parseCsv(text.replace(/^﻿/, ''));
  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const idCol = header.indexOf('const');
  const ratingCol = header.indexOf('your rating');
  if (idCol < 0 || ratingCol < 0) {
    throw new Error(
      'Ez nem az IMDb értékelés-exportja: hiányzik a „Const” vagy a „Your Rating” oszlop. Az IMDb-n az értékeléseid oldaláról exportálj, és a letöltött CSV-fájlt válaszd ki.'
    );
  }

  const ratings = new Map();
  for (const r of rows.slice(1)) {
    const id = r[idCol]?.trim();
    const rating = Number(r[ratingCol]);
    if (/^tt\d+$/.test(id) && Number.isInteger(rating) && rating >= 1 && rating <= 10) {
      ratings.set(id, rating);
    }
  }
  if (ratings.size === 0) {
    throw new Error(
      'A fájlban nincs egyetlen értékelés sem. Az értékeléseid oldaláról exportálj, ne a figyelőlistádból.'
    );
  }
  return ratings;
}

// Mi változna a listán: csak a listán lévő címek csillaga, az állapot nem változik,
// új cím nem kerül fel. Eltérésnél az IMDb értékelése nyer.
export function planRatingImport(titles, ratings) {
  const changes = [];
  const matched = new Set();
  let same = 0;
  for (const t of titles) {
    const rating = t.imdb_id ? ratings.get(t.imdb_id) : undefined;
    if (!rating) continue;
    matched.add(t.imdb_id);
    if (t.my_rating === rating) same++;
    else changes.push({ id: t.id, title: t.title, year: t.release_year, from: t.my_rating ?? null, to: rating });
  }
  changes.sort((a, b) => a.title.localeCompare(b.title, 'hu'));
  return {
    inFile: ratings.size,
    onList: matched.size,
    changes,
    added: changes.filter((c) => c.from == null).length,
    overwritten: changes.filter((c) => c.from != null).length,
    same,
    notOnList: ratings.size - matched.size,
  };
}
