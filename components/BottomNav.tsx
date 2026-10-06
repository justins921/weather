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
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.06] dark:bg-black/80">
      <div className="mx-auto flex max-w-3xl px-2">
        {TABS.map((t) => {
          const active = t.href === '/' ? pathname === '/' : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                active
                  ? 'text-accent-light dark:text-accent-dark'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              <span className="text-xl leading-none">{t.icon}</span>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
