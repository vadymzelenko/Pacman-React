import './globals.css';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Press_Start_2P } from 'next/font/google';
import { LanguageProvider } from '@/lib/i18n';
import { PrefsProvider } from '@/lib/prefs';
import { SessionProvider } from '@/lib/session';

const pixel = Press_Start_2P({
  weight: '400',
  subsets: ['latin', 'cyrillic'],
  variable: '--font-pixel',
  display: 'swap',
});

export const metadata = {
  title: 'Grid Chomp',
  description:
    'Минималистичный аркадный лабиринт: выживание от полиции, кооператив, магазин и глобальный рейтинг.',
};

export const viewport = {
  themeColor: '#08080a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" className={`${GeistSans.variable} ${GeistMono.variable} ${pixel.variable}`}>
      <body className={GeistSans.className}>
        <PrefsProvider>
          <LanguageProvider>
            <SessionProvider>{children}</SessionProvider>
          </LanguageProvider>
        </PrefsProvider>
      </body>
    </html>
  );
}
