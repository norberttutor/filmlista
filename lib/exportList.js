import { mamaLabel, seasonAired, todayDate } from '@/lib/titles';

// A teljes lista mentése CSV-fájlba, a böngészőben (nem kerül fel sehova). Excelben dupla
// kattintással jól nyílik meg: UTF-8 BOM, pontosvessző elválasztó, tizedesvessző.

const SEASON_TEXT = { to_watch: 'nincs megnézve', watching: 'folyamatban', watched: 'megnézve' };

const HEADER = [
  'Típus',
  'Cím',
  'Eredeti cím',
  'Év',
  'Állapot',
  'Letöltve',
  'Megnézve',
  'Saját értékelés',
  'IMDb-értékelés',
  'IMDb-szavazatok',
  'Mama',
  'Franchise',
  'Műfajok',
  'Évadok',
  'Hozzáadva',
  'IMDb ID',
  'TMDB ID',
  'Megjegyzés',
];

// idézőjelbe csak az kerül, amiben elválasztó, idézőjel vagy sortörés van
function cell(value) {
  if (value == null || value === '') return '';
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// "1. megnézve; 2. folyamatban, letöltve; 3. bejelentve: 2026-12-01"
function seasonsText(t, today) {
  return (t.seasons ?? [])
    .map((s) => {
      const state = seasonAired(s, today)
        ? SEASON_TEXT[s.status]
        : `bejelentve${s.air_date ? `: ${s.air_date}` : ''}`;
      return `${s.season_number}. ${state}${s.is_downloaded ? ', letöltve' : ''}`;
    })
    .join('; ');
}

const decimal = (n) =>
  n == null ? '' : n.toLocaleString('hu-HU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// titles: a titles_with_genres sorai; franchiseName: Map(id → név)
export function listToCsv(titles, franchiseName) {
  const today = todayDate();
  const rows = [...titles]
    .sort(
      (a, b) =>
        a.media_type.localeCompare(b.media_type) || a.title.localeCompare(b.title, 'hu')
    )
    .map((t) => [
      t.media_type === 'tv' ? 'Sorozat' : 'Film',
      t.title,
      t.original_title,
      t.release_year,
      t.status_name,
      t.is_downloaded ? 'igen' : 'nem',
      t.watched_at,
      t.my_rating,
      decimal(t.imdb_rating),
      t.imdb_votes,
      mamaLabel(t.mama_status),
      franchiseName.get(t.franchise_id),
      (t.genres ?? []).join(', '),
      seasonsText(t, today),
      t.created_at?.slice(0, 10),
      t.imdb_id,
      t.tmdb_id,
      t.notes,
    ]);
  return '﻿' + [HEADER, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

// letöltés a böngészőben: filmlista-mentes-ÉÉÉÉ-HH-NN.csv
export function downloadListCsv(titles, franchiseName) {
  const blob = new Blob([listToCsv(titles, franchiseName)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `filmlista-mentes-${todayDate()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
