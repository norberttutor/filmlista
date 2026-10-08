import { Bricolage_Grotesque } from 'next/font/google';
import { THEME_BOOT_SCRIPT } from '@/lib/themeBoot';
import './globals.css';

// az optikai méret (opsz) tengelye is kell: a nagy főcím így a betűtípus nagy méretre
// rajzolt formáját kapja, a kis szövegek a kis méretre rajzoltat
const mainFont = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-main',
  axes: ['opsz'],
});

export const metadata = {
  title: 'Megnézendő filmek',
  description: 'Megnézendő filmek és sorozatok',
};

// a böngésző / telepített app címsorának színe (--bg-top), hogy egybeolvadjon a lap tetejével; a
// világos témánál a lib/theme.js cseréli
export const viewport = {
  themeColor: '#1a222d',
};

// a téma (terv-3 50) még a kirajzolás előtt beáll (a <html data-theme>-et a szkript írja, ezért a
// React ne jelezzen rá eltérést)
export default function RootLayout({ children }) {
  return (
    <html lang="hu" className={mainFont.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
