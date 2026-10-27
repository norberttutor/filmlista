// A téma kulcsa és a kirajzolás előtti szkript (terv-3 50) – React nélkül, mert az app/layout.js
// (szerverkomponens) is használja. A többi: lib/theme.js.

export const THEME_LAST_KEY = 'filmlista-tema';
// a színpár (terv-3 142) – az Alapnál nincs jelző
export const PALETTE_LAST_KEY = 'filmlista-szinpar';
export const PALETTE_IDS = ['mergezo', 'vaporwave', 'melytenger', 'zoldsarga'];

// a kirajzolás előtti szkript (app/layout.js): az utoljára használt téma (világos / videotéka – D10) és színpár; a
// megosztott nézési sorrend oldala (/sorrend/…) a látogató gépének beállítását követi (Norbi döntése) – változáskor is
// –, színpár nélkül
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,t,p;
if(location.pathname.indexOf('/sorrend/')===0){var m=matchMedia('(prefers-color-scheme: light)');t=m.matches?'light':'dark';
m.addEventListener('change',function(e){if(e.matches)d.dataset.theme='light';else delete d.dataset.theme;});}
else{t=localStorage.getItem('${THEME_LAST_KEY}');p=localStorage.getItem('${PALETTE_LAST_KEY}');}
if(t==='light'||t==='teka')d.dataset.theme=t;
if(${JSON.stringify(PALETTE_IDS)}.indexOf(p)>=0)d.dataset.pal=p;}catch(e){}})();`;
