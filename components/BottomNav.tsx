'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MapPinIcon,
  BarChartIcon,
  RadarIcon,
  SettingsIcon,
} from './icons';

const TABS = [
  { href: '/', label: 'Locations', Icon: MapPinIcon },
  { href: '/forecast', label: 'Forecast', Icon: BarChartIcon },
  { href: '/radar', label: 'Radar', Icon: RadarIcon },
  { href: '/settings', label: 'Settings', Icon: SettingsIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-white/80 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#131A2E]/85">
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
              <span className="leading-none"><t.Icon size={22} /></span>
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
