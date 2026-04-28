'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchForecast } from '@/lib/api';
import { cachedFetch } from '@/lib/clientCache';
import { fmtMph, fmtTemp, tempColor } from '@/lib/format';
import { dewPointLabel, comingUpSentence, rightNowSentence, windArrow, windCardinal } from '@/lib/narrative';
import { playability } from '@/lib/playability';
import { setSelectedId } from '@/lib/locations';
import type { Forecast, Location } from '@/lib/types';
import { weatherEmoji } from '@/lib/weatherCodes';
import { wearAdvice } from '@/lib/wear';
import BarSeries from './BarSeries';

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
        if (!cancelled) setData(d);
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
          <h2 className="text-lg font-semibold">{loc.name}</h2>
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
          <h2 className="text-lg font-semibold">{loc.name}</h2>
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

  // Build the next 12 hours of per-hour series for the three-bar timeline.
  const nowMs = Date.now();
  let start = 0;
  for (let i = 0; i < data.hourly.time.length; i++) {
    if (new Date(data.hourly.time[i]).getTime() >= nowMs) {
      start = Math.max(0, i - 1);
      break;
    }
  }
  const idx = Array.from(
    { length: Math.min(12, data.hourly.time.length - start) },
    (_, k) => start + k,
  );
  const h = data.hourly;
  const hours = idx.map((i) => h.time[i]);
  const temps = idx.map((i) => h.temperature_2m[i]);
  const feels = idx.map((i) => h.apparent_temperature[i]);
  const winds = idx.map((i) => h.wind_speed_10m[i]);
  const gusts = idx.map((i) => h.wind_gusts_10m[i]);
  const probs = idx.map((i) => h.precipitation_probability[i] ?? 0);
  const playScores = idx.map((i) =>
    playability({
      apparent_temp: h.apparent_temperature[i],
      wind_speed: h.wind_speed_10m[i],
      wind_gusts: h.wind_gusts_10m[i],
      precip_probability: h.precipitation_probability[i] ?? 0,
      humidity: h.relative_humidity_2m[i],
      dew_point: h.dew_point_2m[i],
      cloud_cover: h.cloud_cover[i],
    }),
  );
  // Shared scale for feels/temp so the two graphs are visually comparable.
  const tempScaleMin = Math.min(...temps, ...feels);
  const tempScaleMax = Math.max(...temps, ...feels);

  const wear = wearAdvice({ feels, wind: winds, gusts, precipProb: probs });

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
        <h2 className="text-lg font-semibold">{loc.name}</h2>
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

      <div className="mt-3 space-y-2">
        <Series
          label="Feels like"
          values={feels}
          colorFn={(v) => tempColor(v)}
          formatValue={(v) => `${Math.round(v)}°`}
          scaleMin={tempScaleMin}
          scaleMax={tempScaleMax}
        />
        <Series
          label="Temp"
          values={temps}
          colorFn={(v) => tempColor(v)}
          formatValue={(v) => `${Math.round(v)}°`}
          scaleMin={tempScaleMin}
          scaleMax={tempScaleMax}
        />
        <Series
          label="Playability"
          values={playScores.map((p) => p.score)}
          colorFn={(_, i) => playScores[i].color}
          formatValue={(v) => `${v}`}
          scaleMin={0}
          scaleMax={100}
          hours={hours}
          timezone={data.timezone}
          showHours
        />
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5">
        <span className="text-base leading-tight">{wear.emoji}</span>
        <div className="text-sm leading-snug">
          <span className="font-semibold">Wear:</span> {wear.summary}
        </div>
      </div>

      <div className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: score.color }}>
        <span className="h-1.5 w-1.5 rounded-full bg-white/90" /> {score.label}
      </div>
    </div>
  );
}

type SeriesProps = {
  label: string;
  values: number[];
  colorFn: (v: number, idx: number) => string;
  formatValue: (v: number) => string;
  scaleMin?: number;
  scaleMax?: number;
  hours?: string[];
  timezone?: string;
  showHours?: boolean;
};

function Series(p: SeriesProps) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        {p.label}
      </div>
      <div className="mt-0.5">
        <BarSeries
          values={p.values}
          colorFn={p.colorFn}
          formatValue={p.formatValue}
          scaleMin={p.scaleMin}
          scaleMax={p.scaleMax}
          hours={p.hours}
          timezone={p.timezone}
          showHours={p.showHours}
          height={28}
          ariaLabel={p.label}
        />
      </div>
    </div>
  );
}
