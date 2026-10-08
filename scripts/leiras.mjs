// A felhasználói leírás (FELHASZNALOI-LEIRAS.md) HTML-lé alakítása az appon belüli ablakhoz
// (terv-3 48, components/ManualDialog.js). A build és a dev előtt fut (package.json), a kimenet a
// public/leiras/ mappába kerül (git-ből kizárva, mindig újra előáll):
//   public/leiras/leiras.html – a leírás törzse (a főcím nélkül)
//   public/leiras/kepek/*.jpg – a docs/kepek/ képei
// A fejlécek azonosítója a GitHub szabálya szerint készül (a tartalomjegyzék és a Változásnapló
// hivatkozásai erre mutatnak), „leiras-” előtaggal, hogy az app többi azonosítójával ne ütközzön.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Marked } from 'marked';

const ROOT = join(import.meta.dirname, '..');
const SOURCE = join(ROOT, 'FELHASZNALOI-LEIRAS.md');
const IMAGES = join(ROOT, 'docs', 'kepek');
const OUT = join(ROOT, 'public', 'leiras');
const PREFIX = 'leiras-';

// GitHub-féle azonosító: kisbetű, az írásjelek ki (a betűk – ékezetesek is –, számok, kötőjel,
// aláhúzás maradnak), szóköz → kötőjel; ismétlődésnél „-1”, „-2”…
const used = new Map();
function slug(text) {
  const base = text
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
  const n = used.get(base) ?? 0;
  used.set(base, n + 1);
  return n ? `${base}-${n}` : base;
}

// a JPEG mérete (a SOF-szakaszból), hogy a kép helye betöltés előtt is meglegyen (a hivatkozásra
// ugráskor ne csússzon el a lap)
function jpegSize(file) {
  const b = readFileSync(file);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

let md = readFileSync(SOURCE, 'utf8').replace(/\r\n/g, '\n');
// a főcím az ablak fejlécében van; a VS Code-os előnézetre vonatkozó tipp itt nem érvényes
md = md.replace(/^# .*\n+/, '').replace(/^> Tipp: VS Code[^\n]*\n(?:>[^\n]*\n)*\n?/m, '');

const marked = new Marked({ gfm: true });
marked.use({
  renderer: {
    heading({ tokens, depth, text }) {
      return `<h${depth} id="${PREFIX}${slug(text)}" tabindex="-1">${this.parser.parseInline(tokens)}</h${depth}>\n`;
    },
  },
});

mkdirSync(OUT, { recursive: true });
rmSync(join(OUT, 'kepek'), { recursive: true, force: true });
mkdirSync(join(OUT, 'kepek'));
const sizes = {};
for (const name of readdirSync(IMAGES)) {
  copyFileSync(join(IMAGES, name), join(OUT, 'kepek', name));
  if (/\.jpe?g$/i.test(name)) sizes[name] = jpegSize(join(IMAGES, name));
}

let html = marked.parse(md);
// képek: új útvonal, lusta betöltés, méret (a Markdownben megadott szélességhez arányos magasság)
html = html.replace(/<img\b([^>]*?)\s*\/?>/g, (tag, attrs) => {
  const name = attrs.match(/src="docs\/kepek\/([^"]+)"/)?.[1];
  if (!name) return tag;
  attrs = attrs.replace(`src="docs/kepek/${name}"`, `src="/leiras/kepek/${name}"`);
  const size = sizes[name];
  if (size && !/\bheight=/.test(attrs)) {
    const width = Number(attrs.match(/\bwidth="(\d+)"/)?.[1]);
    attrs = width
      ? `${attrs} height="${Math.round((width * size.height) / size.width)}"`
      : `${attrs} width="${size.width}" height="${size.height}"`;
  }
  return `<img${attrs} loading="lazy" decoding="async">`;
});
// belső hivatkozások az előtagos azonosítókra; külső hivatkozás új lapon
html = html
  .replace(/href="#([^"]+)"/g, (_, id) => `href="#${PREFIX}${decodeURIComponent(id)}"`)
  .replace(/<a href="(https?:[^"]+)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');

// minden belső hivatkozásnak legyen célja (a hibás csak figyelmeztet, a buildet nem állítja meg)
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
const broken = [...new Set([...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]))].filter((id) => !ids.has(id));
if (broken.length) console.warn(`leiras: cél nélküli hivatkozás: ${broken.join(', ')}`);
const missing = [...html.matchAll(/src="\/leiras\/kepek\/([^"]+)"/g)].map((m) => m[1]).filter((n) => !(n in sizes));
if (missing.length) console.warn(`leiras: hiányzó kép: ${missing.join(', ')}`);

writeFileSync(join(OUT, 'leiras.html'), html);
console.log(`leiras: public/leiras/leiras.html (${Math.round(html.length / 1024)} KB, ${Object.keys(sizes).length} kép)`);
