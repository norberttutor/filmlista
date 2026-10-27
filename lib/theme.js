import { useSyncExternalStore } from 'react';
import { PALETTE_IDS, PALETTE_LAST_KEY, THEME_LAST_KEY } from '@/lib/themeBoot';

// Világos / sötét téma (terv-3 50, Norbi döntései, 2026-10-08): az alap a sötét, Mama (néző) alapja a
// világos; a választást a böngésző jegyzi meg, felhasználónként (filmlista-tema:<userId>). Az utoljára
// használt téma külön is (filmlista-tema): ezzel indul a lap – a kirajzolás előtt az app/layout.js
// szkriptje állítja be, így nem villan –, és ezt mutatja a belépési oldal. A témát a <html
// data-theme="light"> kapcsolja (a sötétnél nincs jelző); a színek az app/styles/0[1-3]-*.css-ben.
// Harmadik, választható téma a videotéka (D10, 'teka' – <html data-theme="teka">): a sötétre épül, a ⋮ menü
// „Kinézet” ablakából választható (terv-3 142); a téma váltógombja innen a világosra visz. A színpár: lent.

const THEME_USER_KEY = 'filmlista-tema:';
// a böngésző / telepített app címsorának színe (--bg-top)
const THEME_COLOR = { dark: '#1a222d', light: '#fcf9f4', teka: '#1b1530' };

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // így csak most érvényes
  }
}

const valid = (t) => (t === 'light' || t === 'dark' || t === 'teka' ? t : null);

let current = (typeof document !== 'undefined' && valid(document.documentElement.dataset.theme)) || 'dark';
let user = null; // { id, viewer } – a belépett felhasználó (a választás nála mentődik)
const listeners = new Set();

function apply(theme) {
  const html = document.documentElement;
  if (theme !== 'dark') html.dataset.theme = theme;
  else delete html.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  if (theme !== current) {
    current = theme;
    listeners.forEach((l) => l());
  }
}

// belépéskor (és ha kiderül, néző-e): a felhasználó mentett témája, ha nincs, a szerepéé; a színpár is
export function initUserTheme(userId, viewer) {
  user = { id: userId, viewer };
  const theme = valid(read(THEME_USER_KEY + userId)) ?? (viewer ? 'light' : 'dark');
  write(THEME_LAST_KEY, theme);
  apply(theme);
  const palette = validPalette(read(PALETTE_USER_KEY + userId)) ?? 'alap';
  write(PALETTE_LAST_KEY, palette);
  applyPalette(palette);
}

// kilépéskor: a téma marad (a belépési oldal az utoljára használtat mutatja)
export function forgetThemeUser() {
  user = null;
}

export function setTheme(theme) {
  if (user) write(THEME_USER_KEY + user.id, theme);
  write(THEME_LAST_KEY, theme);
  apply(theme);
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  return useSyncExternalStore(subscribe, () => current, () => 'dark');
}

// Színpár (terv-3 142, Norbi döntése): a fő szín (gombok, kiválasztás, a neon első csöve), a neon második csöve és
// a saját jelölés színe együtt, sötétben és világosban (a tékának saját színei vannak, ott nem érvényes). A ⋮ menü
// „Kinézet” ablakában választható; felhasználónként (filmlista-szinpar:<userId>), az utoljára használt külön is (a
// kirajzolás előtti szkript – lib/themeBoot.js). <html data-pal="…">, az Alapnál nincs jelző; a színek:
// app/styles/02b-szinparok.css. A dots a választó pöttyei ([fő, második cső, saját jelölés]) – a hex itt, mert a
// pár színei csak a <html>-en érvényesek.
export const PALETTES = [
  {
    id: 'alap',
    name: 'Alap',
    description: 'Neon türkiz, lila és borostyán',
    dots: { dark: ['#33e0ef', '#b48cff', '#ffb547'], light: ['#00788c', '#7a4fd6', '#8e4900'] },
  },
  {
    id: 'mergezo',
    name: 'Mérgező',
    description: 'Lime és lila',
    dots: { dark: ['#7eea19', '#be8fff', '#d59aff'], light: ['#3a7400', '#893ed6', '#802baf'] },
  },
  {
    id: 'vaporwave',
    name: 'Vaporwave',
    description: 'Rózsaszín, cián és napsárga',
    dots: { dark: ['#ff61b7', '#00c0d7', '#ffdb68'], light: ['#b51c79', '#007d8d', '#786000'] },
  },
  {
    id: 'melytenger',
    name: 'Mélytenger',
    description: 'Elektromos kék, aqua és citrom',
    dots: { dark: ['#68a5ff', '#00c3c3', '#fcdf00'], light: ['#0062d5', '#007f7f', '#716400'] },
  },
  {
    id: 'zoldsarga',
    name: 'Zöld + sárga',
    description: 'Neonzöld és neonsárga',
    dots: { dark: ['#40f159', '#ebdd00', '#fcdf00'], light: ['#00791d', '#867d00', '#716400'] },
  },
];

const PALETTE_USER_KEY = 'filmlista-szinpar:';
const validPalette = (p) => (p === 'alap' || PALETTE_IDS.includes(p) ? p : null);

let currentPalette = (typeof document !== 'undefined' && validPalette(document.documentElement.dataset.pal)) || 'alap';
const paletteListeners = new Set();

function applyPalette(palette) {
  const html = document.documentElement;
  if (palette !== 'alap') html.dataset.pal = palette;
  else delete html.dataset.pal;
  if (palette !== currentPalette) {
    currentPalette = palette;
    paletteListeners.forEach((l) => l());
  }
}

export function setPalette(palette) {
  if (user) write(PALETTE_USER_KEY + user.id, palette);
  write(PALETTE_LAST_KEY, palette);
  applyPalette(palette);
}

function subscribePalette(listener) {
  paletteListeners.add(listener);
  return () => paletteListeners.delete(listener);
}

export function usePalette() {
  return useSyncExternalStore(subscribePalette, () => currentPalette, () => 'alap');
}
