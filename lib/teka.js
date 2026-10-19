import { genreColor } from '@/lib/genreColors';

// Videotéka-téma (D10, Norbi választása a látványterv után, 2026-10-19 –
// https://claude.ai/artifact/VzCx6F4njpfmNG7FvuUnp5): a borítón a téka jelölései. Csak ebben a témában kerülnek
// a lapra (useTheme() === 'teka'), így a sötét és a világos kinézet nem változik.

// „ÚJ!” matrica: az utóbbi 7 napban felvett cím
const NEW_DAYS = 7;

export function tekaIsNew(t, now = Date.now()) {
  return Boolean(t.created_at) && now - new Date(t.created_at).getTime() < NEW_DAYS * 86400000;
}

// a kategóriacímke („AKCIÓ”, „DRÁMA”): az első műfaj, a műfaj színével
export function tekaCategory(genres) {
  const name = genres?.[0];
  return name ? { label: name.toLocaleUpperCase('hu'), color: genreColor(name) } : null;
}

// a videomagnó képernyőfelirata az állapotról; a megnézendőnél nincs
const OSD = { watching: '▶ LEJÁTSZÁS', watched: '■ VÉGE', dropped: '⏏ KIADVA' };

export function tekaOsd(status) {
  return OSD[status] ?? null;
}

// a Statisztika tagsági kártyájának pecsétje: „OKT 17”
const MONTHS = ['JAN', 'FEBR', 'MÁRC', 'ÁPR', 'MÁJ', 'JÚN', 'JÚL', 'AUG', 'SZEPT', 'OKT', 'NOV', 'DEC'];

export function tekaStamp(day) {
  const [, m, d] = day.slice(0, 10).split('-');
  return `${MONTHS[Number(m) - 1]} ${d}`;
}
