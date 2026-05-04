'use client';

import { useEffect, useState } from 'react';
import { getSelectedLocation, loadLocations, setSelectedId } from '@/lib/locations';
import type { Location } from '@/lib/types';

type HealthStatus = {
  airnow: boolean;
  synoptic: boolean;
};

// Static description of every external data source the app talks to.
// `optional` sources only run when the env var on `envKey` is set; the
// rendered status is driven by /api/health.
type SourceKind = 'always' | 'optional';

type Source = {
  kind: SourceKind;
  name: string;
  url: string;
  // What the app uses this source for, in one short sentence each.
  uses: string[];
  envKey?: 'airnow' | 'synoptic';
  setupHref?: string;
};

const SOURCES: Source[] = [
  {
    kind: 'always',
    name: 'Open-Meteo Forecast',
    url: 'https://open-meteo.com/',
    uses: [
      'Hourly + daily forecast (GFS seamless): the data behind every chart and metric',
      '15-minute nowcast for the precip mini-chart that shows up under Right Now when rain is incoming',
    ],
  },
  {
    kind: 'always',
    name: 'Open-Meteo Ensemble',
    url: 'https://open-meteo.com/en/docs/ensemble-api',
    uses: [
      'ICON ensemble (~40 members) for the p10–p90 confidence band on the Next 24 Hours chart',
    ],
  },
  {
    kind: 'always',
    name: 'Open-Meteo Air Quality',
    url: 'https://open-meteo.com/en/docs/air-quality-api',
    uses: [
      'Modelled AQI when AirNow is unavailable (the card labels itself "modeled" when this falls back)',
      'Hourly AQI trajectory + 6-hour trend arrow on the Air Quality card',
      'Pollen forecast (per-species; CAMS Europe coverage only — null in the US)',
    ],
  },
  {
    kind: 'always',
    name: 'Open-Meteo Geocoding',
    url: 'https://open-meteo.com/en/docs/geocoding-api',
    uses: [
      'City / address search in the location picker',
      'Reverse-geocoding the device GPS for the "Use my current location" entry',
    ],
  },
  {
    kind: 'always',
    name: 'NWS api.weather.gov',
    url: 'https://www.weather.gov/documentation/services-web-api',
    uses: [
      'Active watches / warnings / advisories that drive the alerts banner and override the Coming Up sentence on Severe+',
      'Latest ASOS/AWOS station observation as the fallback for measured "Right now" conditions',
      'Area Forecast Discussion (AFD) text products powering the "What forecasters are saying" section',
    ],
  },
  {
    kind: 'always',
    name: 'Nominatim (OpenStreetMap)',
    url: 'https://nominatim.org/',
    uses: [
      'Course-name search ("Whistling Straits", "Pebble Beach"). Server-proxied with a User-Agent + 1-second throttle to respect their AUP',
    ],
  },
  {
    kind: 'always',
    name: 'RainViewer',
    url: 'https://www.rainviewer.com/api.html',
    uses: [
      'Radar tile frames (past 2h + nowcast) for the Radar tab and the inline preview on the forecast page',
      'Infrared satellite tiles for the Sat / Sat+Radar layers on the Radar tab',
    ],
  },
  {
    kind: 'always',
    name: 'OpenStreetMap tiles',
    url: 'https://www.openstreetmap.org/',
    uses: ['Base map under the radar / satellite overlays'],
  },
  {
    kind: 'optional',
    name: 'EPA AirNow',
    url: 'https://docs.airnowapi.org/',
    envKey: 'airnow',
    setupHref: 'https://docs.airnowapi.org/account/request/',
    uses: [
      'Real station-measured AQI for US locations (replaces the modeled fallback)',
      'PM2.5 dominance flag drives the wildfire-smoke banner on the Air Quality card',
    ],
  },
  {
    kind: 'optional',
    name: 'Synoptic Mesonet',
    url: 'https://synopticdata.com/',
    envKey: 'synoptic',
    setupHref: 'https://customer.synopticdata.com/credentials/',
    uses: [
      'Closer-than-airport observations from ~50K stations (CWOP, RAWS, mesonets, PWS feeds)',
      'When fresh data is in range, takes priority over the NWS airport observation for the "Measured at..." readout',
    ],
  },
];

export default function SettingsPage() {
  const [theme, setTheme] = useState<'auto' | 'light' | 'dark'>('auto');
  const [locations, setLocations] = useState<Location[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    setLocations(loadLocations());
    setDefaultId(getSelectedLocation()?.id ?? null);
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) setHealth({ airnow: !!j.airnow, synoptic: !!j.synoptic });
      })
      .catch(() => {});
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

      <section className="space-y-2 pt-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
          Data Sources
        </div>
        {SOURCES.map((s) => (
          <SourceRow key={s.name} source={s} health={health} />
        ))}
      </section>

      <p className="pt-4 text-[11px] text-fg-light/40 dark:text-fg-dark/40">
        All upstream data is fetched live; nothing is stored on a server. Optional
        keys live in environment variables and are read server-side only.
      </p>
    </div>
  );
}

function SourceRow({ source, health }: { source: Source; health: HealthStatus | null }) {
  const status = sourceStatus(source, health);
  return (
    <div className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold underline decoration-transparent transition-colors hover:decoration-current"
          >
            {source.name}
          </a>
        </div>
        <StatusPill kind={status.kind}>{status.label}</StatusPill>
      </div>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-fg-light/70 dark:text-fg-dark/70">
        {source.uses.map((use, i) => (
          <li key={i}>{use}</li>
        ))}
      </ul>
      {source.kind === 'optional' && status.kind !== 'active' && source.setupHref && (
        <div className="mt-2 text-[11px] text-fg-light/50 dark:text-fg-dark/50">
          Free signup at{' '}
          <a
            href={source.setupHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-light dark:text-accent-dark"
          >
            {source.setupHref}
          </a>
          . Add{' '}
          <code className="rounded bg-black/5 px-1 dark:bg-white/10">
            {source.envKey === 'airnow' ? 'AIRNOW_API_KEY' : 'SYNOPTIC_TOKEN'}
          </code>{' '}
          to your environment.
        </div>
      )}
    </div>
  );
}

type StatusKind = 'active' | 'optional' | 'unconfigured';

function sourceStatus(s: Source, health: HealthStatus | null): { kind: StatusKind; label: string } {
  if (s.kind === 'always') return { kind: 'active', label: 'Active' };
  if (!health) return { kind: 'optional', label: 'Optional' };
  const configured = s.envKey === 'airnow' ? health.airnow : health.synoptic;
  return configured
    ? { kind: 'active', label: 'Active' }
    : { kind: 'unconfigured', label: 'Not configured' };
}

function StatusPill({ kind, children }: { kind: StatusKind; children: React.ReactNode }) {
  const palette =
    kind === 'active'
      ? 'bg-accent-light/20 text-accent-light dark:bg-accent-dark/20 dark:text-accent-dark'
      : kind === 'unconfigured'
        ? 'bg-fg-light/10 text-fg-light/60 dark:bg-fg-dark/10 dark:text-fg-dark/60'
        : 'bg-fg-light/10 text-fg-light/60 dark:bg-fg-dark/10 dark:text-fg-dark/60';
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${palette}`}>
      {children}
    </span>
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
