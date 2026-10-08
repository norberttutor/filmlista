import { useSyncExternalStore } from 'react';
import { THEME_LAST_KEY } from '@/lib/themeBoot';

// Világos / sötét téma (terv-3 50, Norbi döntései, 2026-10-08): az alap a sötét, Mama (néző) alapja a
// világos; a választást a böngésző jegyzi meg, felhasználónként (filmlista-tema:<userId>). Az utoljára
// használt téma külön is (filmlista-tema): ezzel indul a lap – a kirajzolás előtt az app/layout.js
// szkriptje állítja be, így nem villan –, és ezt mutatja a belépési oldal. A témát a <html
// data-theme="light"> kapcsolja (a sötétnél nincs jelző); a színek az app/globals.css-ben.

const THEME_USER_KEY = 'filmlista-tema:';
// a böngésző / telepített app címsorának színe (--bg-top)
export const THEME_COLOR = { dark: '#1a222d', light: '#fcf9f4' };

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

const valid = (t) => (t === 'light' || t === 'dark' ? t : null);

let current =
  typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
let user = null; // { id, viewer } – a belépett felhasználó (a választás nála mentődik)
const listeners = new Set();

function apply(theme) {
  const html = document.documentElement;
  if (theme === 'light') html.dataset.theme = 'light';
  else delete html.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  if (theme !== current) {
    current = theme;
    listeners.forEach((l) => l());
  }
}

// belépéskor (és ha kiderül, néző-e): a felhasználó mentett témája, ha nincs, a szerepéé
export function initUserTheme(userId, viewer) {
  user = { id: userId, viewer };
  const theme = valid(read(THEME_USER_KEY + userId)) ?? (viewer ? 'light' : 'dark');
  write(THEME_LAST_KEY, theme);
  apply(theme);
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
