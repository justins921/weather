'use client';

import { useEffect, useState } from 'react';
import { getSelectedLocation, loadLocations, setSelectedId } from '@/lib/locations';
import type { Location } from '@/lib/types';

export default function SettingsPage() {
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const [locations, setLocations] = useState<Location[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);

  useEffect(() => {
    setLocations(loadLocations());
    setDefaultId(getSelectedLocation()?.id ?? null);
  }, []);

  return (
    <div className="space-y-4 px-4 pt-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Row label="Theme">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as typeof theme)}
          className="rounded-lg bg-black/5 px-2 py-1 text-sm dark:bg-white/10"
        >
          <option value="auto">Auto</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </Row>

      <Row label="Units">
        <span className="text-sm text-fg-light/60 dark:text-fg-dark/60">
          Imperial (locked, US data sources)
        </span>
      </Row>

      <Row label="Default location">
        <select
          value={defaultId ?? ''}
          onChange={(e) => {
            setDefaultId(e.target.value);
            setSelectedId(e.target.value);
          }}
          className="rounded-lg bg-black/5 px-2 py-1 text-sm dark:bg-white/10"
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Row>

      <Row label="About">
        <span className="text-sm text-fg-light/60 dark:text-fg-dark/60">
          Golf Weather · v0.1.0
        </span>
      </Row>

      <p className="pt-4 text-[11px] text-fg-light/40 dark:text-fg-dark/40">
        Data: Open-Meteo · RainViewer · OpenStreetMap
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card-light px-4 py-3 dark:bg-card-dark">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}
