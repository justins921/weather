'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchForecast } from '@/lib/api';
import { cachedFetch } from '@/lib/clientCache';
import { fmtMph, fmtPct, fmtTemp, fmtHourLocal } from '@/lib/format';
import { fetchObservation, isObsRecent, type Observation } from '@/lib/observations';
import { computeHourlyPlayability } from '@/lib/playability';
import { weatherLabel } from '@/lib/weatherCodes';
import type { Forecast, Location } from '@/lib/types';
import MetricGraph, { type GraphMetric } from './MetricGraph';

type Props = {
  loc: Location;
  locations: Location[];
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onAddRequest: () => void;
};

const METRICS: { key: GraphMetric; label: string }[] = [
  { key: 'temp', label: 'Temp' },
  { key: 'feels', label: 'Feels Like' },
  { key: 'wind', label: 'Wind' },
  { key: 'precip', label: 'Precip' },
  { key: 'play', label: 'Playability' },
];

const METRIC_STORAGE_KEY = 'weather.chartMetric';

function humidityComfort(h: number | undefined | null): string {
  if (h == null) return '';
  if (h < 30) return 'Dry';
  if (h <= 60) return 'Comfortable';
  if (h <= 80) return 'Humid';
  return 'Very humid';
}

export default function LocationHero({ loc, locations, onSelect, onRemove, onAddRequest }: Props) {
  const [data, setData] = useState<Forecast | null>(null);
  const [obs, setObs] = useState<Observation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [metric, setMetric] = useState<GraphMetric>('temp');
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    cachedFetch(`fc:${loc.lat},${loc.lon}`, 10 * 60 * 1000, () =>
      fetchForecast(loc.lat, loc.lon, 'gfs_seamless'),
    )
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    cachedFetch(`obs:${loc.lat},${loc.lon}`, 5 * 60 * 1000, () =>
      fetchObservation(loc.lat, loc.lon),
    )
      .then((o) => {
        if (!cancelled) setObs(o);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loc.lat, loc.lon]);

  // Hydrate metric preference (shared with the forecast page chart).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(METRIC_STORAGE_KEY);
    if (stored && METRICS.some((m) => m.key === stored)) {
      setMetric(stored as GraphMetric);
    }
  }, []);

  // Close picker on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const selectMetric = (m: GraphMetric) => {
    setMetric(m);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(METRIC_STORAGE_KEY, m);
    }
  };

  const hours = useMemo(() => {
    if (!data) return [];
    const h = data.hourly;
    const nowMs = Date.now();
    let start = 0;
    for (let i = 0; i < h.time.length; i++) {
      if (new Date(h.time[i]).getTime() >= nowMs) {
        start = Math.max(0, i - 1);
        break;
      }
    }
    const end = Math.min(h.time.length, start + 24);
    return Array.from({ length: end - start }, (_, i) => start + i);
  }, [data]);

  const playScores = useMemo(() => {
    if (!data) return [];
    const scores = computeHourlyPlayability(data, 24);
    // Align to the same hour window as `hours`.
    const byTime = new Map(scores.map((s) => [s.time, s.score]));
    return hours.map((i) => byTime.get(data.hourly.time[i]) ?? 0);
  }, [data, hours]);

  if (!data) {
    return (
      <div className="py-16 text-center text-sm text-fg-light/50 dark:text-fg-dark/50">
        Loading…
      </div>
    );
  }

  const c = data.current;
  const h = data.hourly;
  const obsFresh = isObsRecent(obs);
  const displayFeels =
    obsFresh && obs?.apparent_temperature_f != null
      ? obs.apparent_temperature_f
      : c.apparent_temperature;
  const displayTemp =
    obsFresh && obs?.temperature_f != null ? obs.temperature_f : c.temperature_2m;
  const displayWind =
    obsFresh && obs?.wind_speed_mph != null ? obs.wind_speed_mph : c.wind_speed_10m;
  const displayHumidity =
    obsFresh && obs?.humidity != null ? obs.humidity : c.relative_humidity_2m;

  const condition = weatherLabel(c.weather_code, c.cloud_cover);

  // Metric data for the graph.
  const metricData: Record<GraphMetric, { values: number[]; format: (v: number) => string }> = {
    temp: {
      values: hours.map((i) => h.temperature_2m[i]),
      format: (v) => fmtTemp(v),
    },
    feels: {
      values: hours.map((i) => h.apparent_temperature[i]),
      format: (v) => fmtTemp(v),
    },
    wind: {
      values: hours.map((i) => h.wind_speed_10m[i]),
      format: (v) => `${Math.round(v)}`,
    },
    precip: {
      values: hours.map((i) => h.precipitation_probability[i] ?? 0),
      format: (v) => `${Math.round(v)}%`,
    },
    play: {
      values: playScores,
      format: (v) => `${Math.round(v)}`,
    },
  };

  const active = metricData[metric];
  const hourLabels = hours.map((i) => fmtHourLocal(h.time[i], data.timezone));

  return (
    <div>
      {/* Compact header: location picker left, temp right */}
      <div className="flex items-center justify-between">
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="flex items-center gap-1.5 text-left"
            aria-haspopup="listbox"
            aria-expanded={pickerOpen}
          >
            <span className="text-3xl font-extralight tracking-tight text-fg-light dark:text-fg-dark">
              {loc.name}
            </span>
            <span
              className="text-lg text-fg-light/50 transition-transform dark:text-fg-dark/50"
              style={{ transform: pickerOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              aria-hidden
            >
              ⌄
            </span>
          </button>
          {pickerOpen && (
            <div
              role="listbox"
              className="card absolute left-0 top-full z-20 mt-2 w-64 overflow-hidden py-1"
            >
              {locations.map((l) => (
                <div
                  key={l.id}
                  role="option"
                  aria-selected={l.id === loc.id}
                  className={`flex items-center justify-between px-4 py-2.5 text-[15px] ${
                    l.id === loc.id
                      ? 'font-semibold text-accent-light dark:text-accent-dark'
                      : ''
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelect(l.id);
                      setPickerOpen(false);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {l.isCurrent && <span aria-hidden>📍</span>}
                    <span className="truncate">{l.name}</span>
                  </button>
                  {!l.isCurrent && (
                    <button
                      onClick={() => onRemove(l.id)}
                      className="ml-2 px-1 text-fg-light/40 hover:text-fg-light/80 dark:text-fg-dark/40 dark:hover:text-fg-dark/80"
                      aria-label={`Remove ${l.name}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <div className="border-t border-black/[0.06] dark:border-white/[0.08]">
                <button
                  onClick={() => {
                    setPickerOpen(false);
                    onAddRequest();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-[15px] text-accent-light dark:text-accent-dark"
                >
                  <span aria-hidden>+</span> Add location
                </button>
              </div>
            </div>
          )}
        </div>
        <div
          className="text-5xl font-extralight tracking-tight text-fg-light dark:text-fg-dark"
          aria-label={`Current temperature ${fmtTemp(displayTemp)}`}
        >
          {fmtTemp(displayTemp)}
        </div>
      </div>

      {/* Graph card */}
      <div className="card mt-4 p-5">
        <div className="text-base font-semibold text-accent-light dark:text-accent-dark">
          Today
        </div>
        <div className="mt-0.5 text-[15px] text-fg-light/60 dark:text-fg-dark/60">
          {fmtTemp(displayTemp)} · {condition}
        </div>
        <div className="mt-3">
          <MetricGraph
            values={active.values}
            hourLabels={hourLabels}
            formatValue={active.format}
            playabilityMode={metric === 'play'}
          />
        </div>
        {/* Metric selector pills */}
        <div className="no-scrollbar -mx-1 mt-2 flex gap-2 overflow-x-auto px-1" role="tablist" aria-label="Graph metric">
          {METRICS.map((m) => {
            const isActive = m.key === metric;
            return (
              <button
                key={m.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => selectMetric(m.key)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  isActive
                    ? 'border-transparent bg-accent-light text-white dark:bg-accent-dark'
                    : 'border-accent-light text-accent-light dark:border-accent-dark dark:text-accent-dark'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3-column stat strip */}
      <div className="mt-6 grid grid-cols-3 divide-x divide-black/[0.08] dark:divide-white/[0.1]">
        <div className="flex flex-col items-center gap-1 px-2 text-center">
          <span className="text-xl text-accent-light dark:text-accent-dark" aria-hidden>≋</span>
          <span className="text-sm text-fg-light/60 dark:text-fg-dark/60">Wind</span>
          <span className="text-lg font-medium tabular-nums text-fg-light dark:text-fg-dark">
            {displayWind != null ? `${Math.round(displayWind)} mph` : '–'}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 px-2 text-center">
          <span className="text-xl text-accent-light dark:text-accent-dark" aria-hidden>💧</span>
          <span className="text-sm text-fg-light/60 dark:text-fg-dark/60">Humidity</span>
          <span className="text-lg font-medium tabular-nums text-fg-light dark:text-fg-dark">
            {displayHumidity != null ? fmtPct(displayHumidity) : '–'}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 px-2 text-center">
          <span className="text-xl text-accent-light dark:text-accent-dark" aria-hidden>🌡️</span>
          <span className="text-sm text-fg-light/60 dark:text-fg-dark/60">Feels like</span>
          <span className="text-lg font-medium tabular-nums text-fg-light dark:text-fg-dark">
            {fmtTemp(displayFeels)}
          </span>
        </div>
      </div>
    </div>
  );
}
