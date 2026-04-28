'use client';

import { tempColor } from '@/lib/format';
import { playability } from '@/lib/playability';
import type { Forecast } from '@/lib/types';
import { wearAdvice } from '@/lib/wear';
import BarSeries from './BarSeries';

type Props = {
  forecast: Forecast;
  // Bar pixel height per row (cards run tighter than the forecast detail page).
  height?: number;
};

// Three stacked rows for the next 12 hours: Feels like, Temp, Playability,
// each with a value label above every bar. Hour ticks live on the bottom row.
// Below the bars, a Wear advice line.
export default function HourlyBars({ forecast, height = 32 }: Props) {
  const h = forecast.hourly;
  const nowMs = Date.now();
  let start = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (new Date(h.time[i]).getTime() >= nowMs) {
      start = Math.max(0, i - 1);
      break;
    }
  }
  const idx = Array.from(
    { length: Math.min(12, h.time.length - start) },
    (_, k) => start + k,
  );
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
  // Shared scale for feels and temp so the two rows are visually comparable.
  const tempScaleMin = Math.min(...temps, ...feels);
  const tempScaleMax = Math.max(...temps, ...feels);
  const wear = wearAdvice({ feels, wind: winds, gusts, precipProb: probs });

  return (
    <div>
      <div className="space-y-2">
        <Row label="Feels like">
          <BarSeries
            values={feels}
            colorFn={(v) => tempColor(v)}
            formatValue={(v) => `${Math.round(v)}°`}
            scaleMin={tempScaleMin}
            scaleMax={tempScaleMax}
            height={height}
            ariaLabel="Feels like, next 12 hours"
          />
        </Row>
        <Row label="Temp">
          <BarSeries
            values={temps}
            colorFn={(v) => tempColor(v)}
            formatValue={(v) => `${Math.round(v)}°`}
            scaleMin={tempScaleMin}
            scaleMax={tempScaleMax}
            height={height}
            ariaLabel="Temperature, next 12 hours"
          />
        </Row>
        <Row label="Playability">
          <BarSeries
            values={playScores.map((p) => p.score)}
            colorFn={(_, i) => playScores[i].color}
            formatValue={(v) => `${v}`}
            scaleMin={0}
            scaleMax={100}
            hours={hours}
            timezone={forecast.timezone}
            showHours
            height={height}
            ariaLabel="Playability score, next 12 hours"
          />
        </Row>
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-black/5 px-3 py-2 dark:bg-white/5">
        <span className="text-base leading-tight">{wear.emoji}</span>
        <div className="text-sm leading-snug">
          <span className="font-semibold">Wear:</span> {wear.summary}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        {label}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
