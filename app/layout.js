import { Bricolage_Grotesque } from 'next/font/google';
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

// a böngésző / telepített app címsorának színe (--bg-top), hogy egybeolvadjon a lap tetejével
export const viewport = {
  themeColor: '#1a222d',
};

export default function RootLayout({ children }) {
  return (
    <html lang="hu" className={mainFont.variable}>
      <body>{children}</body>
    </html>
  );
}
