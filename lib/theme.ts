'use client';

// Theme override stored in localStorage. With Tailwind's `darkMode: 'class'`,
// the .dark class on <html> is what flips colors. This module is the
// single client-side owner of that class.
//
// IMPORTANT: app/layout.tsx ships a tiny inline script that mirrors the
// `dark` decision below so the class is on <html> before the first paint
// — otherwise you get a brief flash of light theme. Keep the two in sync
// when changing the storage key or the matchMedia query.

export type Theme = 'auto' | 'light' | 'dark';
export const THEME_KEY = 'weather.theme';

export function loadTheme(): Theme {
  if (typeof window === 'undefined') return 'auto';
  const v = window.localStorage.getItem(THEME_KEY);
  return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto';
}

export function saveTheme(t: Theme): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(THEME_KEY, t);
  applyTheme(t);
}

export function applyTheme(t: Theme): void {
  if (typeof window === 'undefined') return;
  const dark =
    t === 'dark' ||
    (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}
