import { Bricolage_Grotesque } from 'next/font/google';
import './globals.css';

const mainFont = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-main',
});

export const metadata = {
  title: 'Megnézendő filmek',
  description: 'Megnézendő filmek és sorozatok',
};

export default function RootLayout({ children }) {
  return (
    <html lang="hu" className={mainFont.variable}>
      <body>{children}</body>
    </html>
  );
}
