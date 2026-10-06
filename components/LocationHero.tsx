'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchForecast } from '@/lib/api';
import { cachedFetch } from '@/lib/clientCache';
import { fmtTemp, fmtHourLocal } from '@/lib/format';
import { windCardinal } from '@/lib/narrative';
import { fetchObservation, isObsRecent, type Observation } from '@/lib/observations';
import { weatherEmoji, weatherLabel } from '@/lib/weatherCodes';
import type { Forecast, Location } from '@/lib/types';
import TempCurve from './TempCurve';

type Props = {
  loc: Location;
};

function humidityComfort(h: number | undefined | null): string {
  if (h == null) return '';
  if (h < 30) return 'Dry';
  if (h <= 60) return 'Comfortable';
  if (h <= 80) return 'Humid';
  return 'Very humid';
}

export default function LocationHero({ loc }: Props) {
  const router = useRouter();
  const [data, setData] = useState<Forecast | null>(null);
  const [obs, setObs] = useState<Observation | null>(null);

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

  const high = data.daily.temperature_2m_max?.[0];
  const low = data.daily.temperature_2m_min?.[0];
  const condition = weatherLabel(c.weather_code, c.cloud_cover);

  return (
    <div>
      {/* Hero temperature */}
      <div className="mt-2 flex items-start justify-center">
        <div className="temp-hero">{fmtTemp(displayFeels)}</div>
        <span className="mt-6 text-4xl" aria-hidden>
          {weatherEmoji(c.weather_code, c.cloud_cover, c.is_day ?? 1)}
        </span>
      </div>
      <div className="mt-1 text-center text-[15px] text-fg-light/60 dark:text-fg-dark/60">
        {condition}
        {high != null && low != null && (
          <span>
            {' '}· {fmtTemp(low)} / {fmtTemp(high)}
          </span>
        )}
      </div>

      {/* Thin divider */}
      <div className="mx-auto mt-5 h-px w-24 bg-black/10 dark:bg-white/10" />

      {/* Stat grid */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="stat-cell rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
          <span className="text-2xl" aria-hidden>≋</span>
          <span className="stat-label">Wind</span>
          <span className="stat-value">{displayWind != null ? `${Math.round(displayWind)} mph` : '–'}</span>
          <span className="stat-sub">{windCardinal(c.wind_direction_10m ?? 0)}</span>
        </div>
        <div className="stat-cell rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
          <span className="text-2xl" aria-hidden>💧</span>
          <span className="stat-label">Humidity</span>
          <span className="stat-value">
            {displayHumidity != null ? `${Math.round(displayHumidity)}%` : '–'}
          </span>
          <span className="stat-sub">{humidityComfort(displayHumidity)}</span>
        </div>
      </div>

      {/* Hourly forecast */}
      <div className="mt-8 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Hourly Forecast</h2>
        <button
          onClick={() => router.push('/forecast')}
          className="text-[15px] font-medium text-accent-light dark:text-accent-dark"
        >
          Now
        </button>
      </div>
      <div className="mt-3 rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.04]">
        <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1">
          {hours.map((i, idx) => (
            <div key={h.time[i]} className="flex w-12 shrink-0 flex-col items-center gap-1">
              <div className="text-xs font-medium text-fg-light/70 dark:text-fg-dark/70">
                {idx === 0 ? 'Now' : fmtHourLocal(h.time[i], data.timezone)}
              </div>
              <div className="text-[15px] font-semibold tabular-nums">
                {fmtTemp(h.temperature_2m[i])}
              </div>
              <div className="text-lg leading-none" aria-hidden>
                {weatherEmoji(h.weather_code[i], h.cloud_cover[i], h.is_day?.[i] ?? 1)}
              </div>
              {idx === 1 && (
                <div className="h-1.5 w-1.5 rounded-full bg-accent-light dark:bg-accent-dark" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-1">
          <TempCurve temps={hours.map((i) => h.temperature_2m[i])} height={64} />
        </div>
      </div>

      {/* Feels-like subline for context */}
      <div className="mt-3 text-center text-xs text-fg-light/50 dark:text-fg-dark/50">
        Feels like {fmtTemp(displayFeels)} · Actual {fmtTemp(displayTemp)}
      </div>
    </div>
  );
}
