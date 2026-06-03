import type { Metadata } from 'next';
import { Anton, Space_Mono } from 'next/font/google';
import './globals.css';

// next/font/google gestiona subset, preload y display:swap automáticamente,
// eliminando el parpadeo de fuentes (FOUC) que tendríamos con <link> manual.
const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
});

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-space-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RABAT — donde firmas y no te f*llan',
  description: 'Portal de artistas RABAT — sube tu lanzamiento sin fricciones.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${anton.variable} ${spaceMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
