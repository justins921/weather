'use client';

import { useEffect, useState } from 'react';
import type { AirQualityReading } from '@/lib/airQuality';
import { categoryStyle } from '@/lib/airQuality';
import {
  beaufortLabel,
  fmtMph,
  fmtTemp,
  uvColor,
  uvShort,
  visibilityLabel,
} from '@/lib/format';
import { moonPhase } from '@/lib/moon';
import { dewPointLabel, windCardinal } from '@/lib/narrative';
import { pressureTrend } from '@/lib/pressureTrend';
import type { Forecast } from '@/lib/types';

const STORAGE_KEY = 'weather.rightNowExpanded';

type Props = {
  forecast: Forecast;
  // Resolved "current" values (NWS obs when fresh, otherwise model). All
  // of these the page already computes once for the hero.
  windSpeed: number;
  windDir: number;
  windGusts: number;
  humidity: number;
  dewPoint: number;
  // From the daily block.
  highF: number;
  lowF: number;
  uvMax: number;
  // Optional supplementary signals.
  airQuality: AirQualityReading | null;
};

// Acme-Weather-style expandable detail block. High/Low line is always
// visible; the 3×3 grid of metric tiles toggles via the More/Less link.
// Toggle preference persists in localStorage so the user's choice
// survives reloads.
export default function RightNowDetail({
  forecast,
  windSpeed,
  windDir,
  windGusts,
  humidity,
  dewPoint,
  highF,
  lowF,
  uvMax,
  airQuality,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'false') setExpanded(false);
    else if (stored === 'true') setExpanded(true);
  }, []);

  function toggle() {
    setExpanded((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  }

  // Pressure: read the hourly slot bracketing "now", with trend over the
  // past 6 hours (Open-Meteo's past_hours buffer).
  const pressureNow = pressureAt(forecast, 0);
  const pressureSixAgo = pressureAt(forecast, -6);
  const trend =
    pressureNow != null && pressureSixAgo != null
      ? pressureTrend(pressureNow, pressureSixAgo)
      : null;
  const pressureLabel = trend ? trend.label.replace(' pressure', '') : 'Steady';

  // Visibility: meters → miles with one decimal.
  const visM = hourlyAt(forecast, 'visibility', 0);
  const visMi = typeof visM === 'number' ? +(visM * 0.000621371).toFixed(1) : null;

  const moon = moonPhase();

  const aqStyle = airQuality ? categoryStyle(airQuality.category) : null;

  return (
    <div>
      <div className="text-sm text-fg-light/70 dark:text-fg-dark/70">
        High {fmtTemp(highF)} · Low {fmtTemp(lowF)}
      </div>
      <button
        type="button"
        onClick={toggle}
        className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-accent-light dark:text-accent-dark"
        aria-expanded={expanded}
      >
        {expanded ? 'Less' : 'More'}
        <span aria-hidden>{expanded ? '⌃' : '⌄'}</span>
      </button>

      {expanded && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Tile
            label="Wind Speed"
            value={fmtMph(windSpeed)}
            sub={`from ${windCardinal(windDir)}`}
          />
          <Tile
            label="Wind Gust"
            value={fmtMph(windGusts)}
            sub={beaufortLabel(windGusts)}
          />
          <Tile
            label="Air Quality"
            value={airQuality ? `${airQuality.aqi}` : '—'}
            sub={
              aqStyle ? (
                <span className="inline-flex items-center gap-1">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: aqStyle.color }}
                    aria-hidden
                  />
                  {aqStyle.label}
                </span>
              ) : (
                '—'
              )
            }
          />
          <Tile
            label="Dew Point"
            value={fmtTemp(dewPoint)}
            sub={dewPointLabel(dewPoint)}
          />
          <Tile
            label="Humidity"
            value={`${Math.round(humidity)}%`}
            sub={
              <HumidityBar pct={humidity} />
            }
          />
          <Tile
            label="Pressure"
            value={pressureNow != null ? `${Math.round(pressureNow)} hPa` : '—'}
            sub={pressureLabel}
          />
          <Tile
            label="UV Index"
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
            label="Visibility"
            value={visMi != null ? `${visMi} mi` : '—'}
            sub={visMi != null ? visibilityLabel(visMi) : '—'}
          />
          <Tile
            label="Moon Phase"
            value={moon.emoji}
            sub={moon.name}
          />
        </div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-card-light p-3 text-center dark:bg-card-dark">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-light/55 dark:text-fg-dark/55">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold leading-tight">{value}</div>
      <div className="mt-0.5 text-[11px] text-fg-light/60 dark:text-fg-dark/60">
        {sub}
      </div>
    </div>
  );
}

function HumidityBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="mx-auto mt-0.5 h-1 w-12 rounded-full bg-fg-light/10 dark:bg-fg-dark/10">
      <div
        className="h-1 rounded-full bg-fg-light/70 dark:bg-fg-dark/70"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// Read an hourly value at the slot bracketing "now" (offset = 0) or
// `offset` hours before it. Browser-local parsing matches the rest of
// the app's hourly time logic.
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

function pressureAt(f: Forecast, offset: number): number | null {
  return hourlyAt(f, 'surface_pressure', offset);
}
