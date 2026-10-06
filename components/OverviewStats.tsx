'use client';

import type { AirQualityReading } from '@/lib/airQuality';
import { categoryStyle } from '@/lib/airQuality';
import {
  fmtMph,
  fmtTemp,
  uvColor,
  uvShort,
  visibilityLabel,
} from '@/lib/format';
import { dewPointLabel, windCardinal } from '@/lib/narrative';
import { pressureTrend } from '@/lib/pressureTrend';
import type { Forecast } from '@/lib/types';

type Props = {
  forecast: Forecast;
  windSpeed: number;
  windDir: number;
  windGusts: number;
  humidity: number;
  dewPoint: number;
  uvMax: number;
  airQuality: AirQualityReading | null;
};

// Overview tab stat grid: the 9 tiles from the tabbed detail mockup —
// Wind, Humidity, UV, Rainfall, Pressure, Visibility, Cloud Cover,
// Turf Temp, Dew Point. Uses the shared .stat-* design system classes.
export default function OverviewStats({
  forecast,
  windSpeed,
  windDir,
  windGusts,
  humidity,
  dewPoint,
  uvMax,
  airQuality,
}: Props) {
  const c = forecast.current;

  // Pressure with 6-hour trend.
  const pressureNow = hourlyAt(forecast, 'surface_pressure', 0);
  const pressureSixAgo = hourlyAt(forecast, 'surface_pressure', -6);
  const trend =
    pressureNow != null && pressureSixAgo != null
      ? pressureTrend(pressureNow, pressureSixAgo)
      : null;
  const pressureLabel = trend ? trend.label.replace(' pressure', '') : 'Steady';

  // Visibility capped at 10+ mi (same convention as RightNowDetail).
  const visMRaw = hourlyAt(forecast, 'visibility', 0);
  const visMiRaw = typeof visMRaw === 'number' ? visMRaw * 0.000621371 : null;
  const visDisplay =
    visMiRaw == null
      ? '—'
      : visMiRaw >= 10
        ? '10+ mi'
        : `${visMiRaw.toFixed(1)} mi`;
  const visLabel = visMiRaw == null ? '—' : visibilityLabel(Math.min(10, visMiRaw));

  // Rainfall: sum of the next 24 hourly slots, in inches.
  const rainIn = next24hSum(forecast, 'precipitation') * 0.0393701;
  const rainDisplay = rainIn < 0.005 ? '0.0 in' : `${rainIn.toFixed(1)} in`;

  // Cloud cover right now.
  const cloudNow = typeof c.cloud_cover === 'number' ? c.cloud_cover : null;

  // Turf temp: soil temperature at the surface, current slot. Falls back
  // to air temp when the field is missing (older cached responses).
  const turfC = hourlyAt(forecast, 'soil_temperature_0cm', 0);
  const turfF = turfC != null ? turfC * 1.8 + 32 : null;

  const aqStyle = airQuality ? categoryStyle(airQuality.category) : null;

  return (
    <div className="grid grid-cols-3 gap-2">
      <Tile
        icon="≋"
        label="Wind"
        value={fmtMph(windSpeed)}
        sub={`${windCardinal(windDir)} · gusts ${fmtMph(windGusts)}`}
      />
      <Tile
        icon="💧"
        label="Humidity"
        value={`${Math.round(humidity)}%`}
        sub={humidity < 40 ? 'Dry' : humidity <= 65 ? 'Comfortable' : 'Humid'}
      />
      <Tile
        icon="☀️"
        label="UV"
        value={`${Math.round(uvMax)}`}
        sub={
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: uvColor(uvMax) }}
              aria-hidden
            />
            {uvShort(uvMax)}
          </span>
        }
      />
      <Tile
        icon="🌧️"
        label="Rainfall"
        value={rainDisplay}
        sub="next 24h"
      />
      <Tile
        icon="🧭"
        label="Pressure"
        value={pressureNow != null ? `${Math.round(pressureNow)} hPa` : '—'}
        sub={pressureLabel}
      />
      <Tile
        icon="👁️"
        label="Visibility"
        value={visDisplay}
        sub={visLabel}
      />
      <Tile
        icon="☁️"
        label="Cloud Cover"
        value={cloudNow != null ? `${Math.round(cloudNow)}%` : '—'}
        sub={cloudNow == null ? '—' : cloudNow < 25 ? 'Clear' : cloudNow < 60 ? 'Partly cloudy' : 'Overcast'}
      />
      <Tile
        icon="🌱"
        label="Turf Temp"
        value={turfF != null ? `${Math.round(turfF)}°F` : '—'}
        sub={turfF == null ? '—' : turfF < 45 ? 'Cold turf' : turfF < 65 ? 'Firm' : 'Soft'}
      />
      <Tile
        icon="💦"
        label="Dew Point"
        value={fmtTemp(dewPoint)}
        sub={dewPointLabel(dewPoint)}
      />
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
}) {
  return (
    <div className="stat-cell rounded-2xl border border-black/[0.06] dark:border-white/[0.08]">
      <div className="text-xl text-accent-light dark:text-accent-dark" aria-hidden>
        {icon}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value leading-tight">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function hourlyAt(f: Forecast, key: keyof Forecast['hourly'], offset: number): number | null {
  const arr = f.hourly[key];
  if (!Array.isArray(arr)) return null;
  const nowMs = Date.now();
  let idx = 0;
  for (let i = 0; i < f.hourly.time.length; i++) {
    if (new Date(f.hourly.time[i]).getTime() >= nowMs) {
      idx = Math.max(0, i - 1);
      break;
    }
  }
  const target = idx + offset;
  if (target < 0 || target >= (arr as number[]).length) return null;
  const v = (arr as number[])[target];
  return typeof v === 'number' ? v : null;
}

function next24hSum(f: Forecast, key: keyof Forecast['hourly']): number {
  const arr = f.hourly[key];
  if (!Array.isArray(arr)) return 0;
  const nowMs = Date.now();
  let idx = 0;
  for (let i = 0; i < f.hourly.time.length; i++) {
    if (new Date(f.hourly.time[i]).getTime() >= nowMs) {
      idx = Math.max(0, i - 1);
      break;
    }
  }
  let sum = 0;
  for (let k = idx; k < Math.min(idx + 24, (arr as number[]).length); k++) {
    const v = (arr as number[])[k];
    if (typeof v === 'number') sum += v;
  }
  return sum;
}
