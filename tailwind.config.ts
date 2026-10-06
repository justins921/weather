import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  // Class-based so the user can override OS preference from Settings.
  // The .dark class is set on <html> by the inline script in
  // app/layout.tsx before first paint and toggled by lib/theme.ts.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          light: '#ffffff',
          dark: '#0A0F1E',
        },
        fg: {
          light: '#0a0a0a',
          dark: '#F1F5F9',
        },
        card: {
          light: '#f5f5f5',
          dark: '#131A2E',
        },
        accent: {
          light: '#2563eb',
          dark: '#3B82F6',
        },
      },
      fontFamily: {
        sys: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        serif: ['ui-serif', 'Georgia', 'Cambria', 'Times New Roman', 'Times', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
