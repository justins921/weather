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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg-light text-fg-light dark:bg-bg-dark dark:text-fg-dark font-sys">
        <main className="mx-auto max-w-3xl pb-24">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
