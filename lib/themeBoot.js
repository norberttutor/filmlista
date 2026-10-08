// A téma kulcsa és a kirajzolás előtti szkript (terv-3 50) – React nélkül, mert az app/layout.js
// (szerverkomponens) is használja. A többi: lib/theme.js.

export const THEME_LAST_KEY = 'filmlista-tema';

// a kirajzolás előtti szkript (app/layout.js): az utoljára használt téma; a megosztott nézési sorrend
// oldala (/sorrend/…) a látogató gépének beállítását követi (Norbi döntése) – változáskor is
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,t;
if(location.pathname.indexOf('/sorrend/')===0){var m=matchMedia('(prefers-color-scheme: light)');t=m.matches?'light':'dark';
m.addEventListener('change',function(e){if(e.matches)d.dataset.theme='light';else delete d.dataset.theme;});}
else{t=localStorage.getItem('${THEME_LAST_KEY}');}
if(t==='light')d.dataset.theme='light';}catch(e){}})();`;
