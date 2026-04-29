'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchForecast } from '@/lib/api';
import { cachedFetch } from '@/lib/clientCache';
import { fmtMph, fmtTemp } from '@/lib/format';
import { dewPointLabel, comingUpSentence, rightNowSentence, windArrow, windCardinal } from '@/lib/narrative';
import { playability } from '@/lib/playability';
import { setSelectedId, setLocationElevation } from '@/lib/locations';
import type { Forecast, Location } from '@/lib/types';
import { weatherEmoji } from '@/lib/weatherCodes';
import { carryMultiplier, playsColor, playsLabel, playsYards } from '@/lib/airDensity';
import ClubWindLine from './ClubWindLine';
import HourlyBars from './HourlyBars';
import PressureTrendLine from './PressureTrendLine';

type Props = {
  loc: Location;
  onRemove: (id: string) => void;
};

export default function LocationCard({ loc, onRemove }: Props) {
  const router = useRouter();
  const [data, setData] = useState<Forecast | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    cachedFetch(`fc:${loc.lat},${loc.lon}`, 30 * 60 * 1000, () =>
      fetchForecast(loc.lat, loc.lon, 'gfs_seamless'),
    )
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // Capture elevation back onto the location once we know it.
        if (loc.elevation_ft === undefined && typeof d.elevation === 'number') {
          setLocationElevation(loc.id, d.elevation);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load');
      });
    return () => {
      cancelled = true;
    };
  }, [loc.lat, loc.lon]);

  function open() {
    setSelectedId(loc.id);
    router.push('/forecast');
  }

  if (err) {
    return (
      <div className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{loc.isCurrent && <span aria-label="Current location" title="Current location" className="mr-1">📍</span>}{loc.name}</h2>
          <button
            onClick={() => onRemove(loc.id)}
            className="text-fg-light/40 hover:text-fg-light/80 dark:text-fg-dark/40 dark:hover:text-fg-dark/80"
            aria-label="Remove"
          >
            ×
          </button>
        </div>
        <div className="mt-2 text-sm text-red-500">{err}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{loc.isCurrent && <span aria-label="Current location" title="Current location" className="mr-1">📍</span>}{loc.name}</h2>
        </div>
        <div className="mt-2 text-sm text-fg-light/50 dark:text-fg-dark/50">Loading…</div>
      </div>
    );
  }

  const c = data.current;
  const score = playability({
    apparent_temp: c.apparent_temperature,
    wind_speed: c.wind_speed_10m,
    wind_gusts: c.wind_gusts_10m,
    precip_probability: data.hourly.precipitation_probability[0] ?? 0,
    humidity: c.relative_humidity_2m,
    dew_point: c.dew_point_2m,
    cloud_cover: c.cloud_cover,
  });


  return (
    <div
      className="cursor-pointer rounded-2xl bg-card-light p-4 transition hover:bg-black/5 dark:bg-card-dark dark:hover:bg-white/5"
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') open();
      }}
    >
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold">{loc.isCurrent && <span aria-label="Current location" title="Current location" className="mr-1">📍</span>}{loc.name}</h2>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(loc.id);
          }}
          className="-mr-1 -mt-1 px-2 py-1 text-fg-light/40 hover:text-fg-light/80 dark:text-fg-dark/40 dark:hover:text-fg-dark/80"
          aria-label={`Remove ${loc.name}`}
        >
          ×
        </button>
      </div>

      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        Right now
      </div>
      <div className="text-base">{rightNowSentence(data)}</div>

      <div className="mt-3 flex items-center gap-4">
        <div className="text-5xl">{weatherEmoji(c.weather_code, c.cloud_cover)}</div>
        <div>
          <div className="text-5xl font-semibold leading-none">{fmtTemp(c.temperature_2m)}</div>
          <div className="mt-1 text-xs text-fg-light/60 dark:text-fg-dark/60">
            Feels {fmtTemp(c.apparent_temperature)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
            Wind
          </div>
          <div className="mt-1 text-base font-semibold">
            {fmtMph(c.wind_speed_10m)} {windArrow(c.wind_direction_10m)}
          </div>
          <div className="text-[11px] text-fg-light/60 dark:text-fg-dark/60">
            From the {windCardinal(c.wind_direction_10m)}. Gusts to {Math.round(c.wind_gusts_10m)}mph.
          </div>
          <ClubWindLine windSpeed={c.wind_speed_10m} gusts={c.wind_gusts_10m} />
          <PressureTrendLine forecast={data} />
        </div>
        <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
            Dew Point
          </div>
          <div className="mt-1 text-base font-semibold">
            {fmtTemp(c.dew_point_2m)} 💧
          </div>
          <div className="text-[11px] text-fg-light/60 dark:text-fg-dark/60">
            {dewPointLabel(c.dew_point_2m)}
          </div>
        </div>
      </div>

      <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        Coming up
      </div>
      <div className="text-sm">{comingUpSentence(data)}</div>

      <div className="mt-3">
        <HourlyBars forecast={data} height={28} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: score.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white/90" /> {score.label}
        </span>
        {(() => {
          // Pick the hourly slot that brackets "now" so we read pressure from
          // roughly the current hour, not whatever's at index 0 (which may be
          // 6 hours ago thanks to past_hours).
          const nowMs = Date.now();
          let pIdx = 0;
          for (let i = 0; i < data.hourly.time.length; i++) {
            if (new Date(data.hourly.time[i]).getTime() >= nowMs) {
              pIdx = Math.max(0, i - 1);
              break;
            }
          }
          const inputs = {
            apparent_temp_f: c.apparent_temperature,
            elevation_ft: loc.elevation_ft ?? Math.round(data.elevation * 3.28084),
            surface_pressure_hpa: data.hourly.surface_pressure?.[pIdx] ?? 1013,
            relative_humidity: c.relative_humidity_2m,
          };
          const yds = playsYards(carryMultiplier(inputs));
          if (Math.abs(yds) < 2) return null;
          const color = playsColor(yds);
          return (
            <span
              className="text-xs font-medium"
              style={color ? { color } : undefined}
            >
              🎯 {playsLabel(yds)}
            </span>
          );
        })()}
      </div>
    </div>
  );
}

