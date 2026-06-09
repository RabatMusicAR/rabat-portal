import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Fuentes OFICIALES del brandguide, servidas localmente desde app/fonts.
// next/font/local gestiona el preload y display:swap (sin parpadeo / FOUC),
// y autoaloja los archivos (no dependemos de Google Fonts).

// Display = Helvetica Neue Extra Black Condensed (un solo peso, "Black" = 900)
const display = localFont({
  src: './fonts/HelveticaNeueCondensedBlack.ttf',
  weight: '900',
  display: 'swap',
  variable: '--font-display-face',
});

// Body / UI = Monospac821 BT (Roman 400 + Bold 700)
const mono = localFont({
  src: [
    { path: './fonts/Monospac821BT-Roman.ttf', weight: '400', style: 'normal' },
    { path: './fonts/Monospac821BT-Bold.ttf', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-mono-face',
});

export const metadata: Metadata = {
  title: 'RABAT — donde firmas y no te f*llan',
  description: 'Portal de artistas RABAT — sube tu lanzamiento sin fricciones.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
