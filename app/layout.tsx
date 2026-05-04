import type { Metadata, Viewport } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'Golf Weather',
  description: 'Weather, tuned for whether you should play.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

// Inline script: set the .dark class on <html> BEFORE first paint based
// on the user's saved theme override (or system preference when "auto").
// Mirrors the decision in lib/theme.ts. Without this, the page would
// flash light-themed for one frame on every reload in dark mode.
const themeBootScript = `
  (function() {
    try {
      var t = localStorage.getItem('weather.theme') || 'auto';
      var dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (dark) document.documentElement.classList.add('dark');
    } catch (e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen bg-bg-light text-fg-light dark:bg-bg-dark dark:text-fg-dark font-sys">
        <main className="mx-auto max-w-3xl pb-24">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
