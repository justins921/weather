'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Locations', icon: '📍' },
  { href: '/forecast', label: 'Forecast', icon: '📊' },
  { href: '/radar', label: 'Radar', icon: '🌐' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-bg-light/90 backdrop-blur dark:border-white/10 dark:bg-bg-dark/90">
      <div className="mx-auto flex max-w-3xl">
        {TABS.map((t) => {
          const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                active
                  ? 'text-accent-light dark:text-accent-dark'
                  : 'text-fg-light/60 dark:text-fg-dark/60'
              }`}
            >
              <span className="text-lg leading-none">{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
