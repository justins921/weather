'use client';

import { useState } from 'react';
import type { Forecast } from '@/lib/types';
import { weatherEmoji } from '@/lib/weatherCodes';

type Props = {
  primary: Forecast;
  alternates?: Forecast[];
};

const HOURS = 24;

// Hand-rolled SVG. One responsive chart with the primary forecast as a bold
// white line and any number of alternate models drawn as ghosted curves
// behind it. Header row groups precip % into Evening / Overnight / Morning /
// Afternoon equal-width buckets. A "Now" indicator marks current time. A
// toggle pill at the bottom hides/shows the alternates.
export default function Next24HoursChart({ primary, alternates = [] }: Props) {
  const [showAlts, setShowAlts] = useState(true);

  // Snap chart start to the current local hour. Indices match in primary
  // and each alternate because Open-Meteo returns hourly data on aligned
  // timestamps for the same coordinate.
  const nowMs = Date.now();
  const currentHourMs = nowMs - (nowMs % 3600000);

  const startIdx = findHourIndex(primary, currentHourMs);
  if (startIdx + HOURS >= primary.hourly.time.length) return null;

  const idx = Array.from({ length: HOURS + 1 }, (_, k) => startIdx + k);
  const times = idx.map((i) => primary.hourly.time[i]);
  const tz = primary.timezone;

  const primaryTemps = idx.map((i) => primary.hourly.temperature_2m[i]);
  const primaryCodes = idx.map((i) => primary.hourly.weather_code[i]);
  const primaryClouds = idx.map((i) => primary.hourly.cloud_cover[i]);
  const primaryIsDay = idx.map((i) => primary.hourly.is_day?.[i] ?? 1);
  const precipProbs = idx.map((i) => primary.hourly.precipitation_probability[i] ?? 0);

  const altSeries = alternates.map((alt) => {
    const altStart = findHourIndex(alt, currentHourMs);
    return Array.from({ length: HOURS + 1 }, (_, k) => alt.hourly.temperature_2m[altStart + k]);
  });

  // Y-range — leave headroom above for the temp/emoji labels.
  const allTemps = [...primaryTemps, ...altSeries.flat()].filter(
    (t): t is number => typeof t === 'number' && Number.isFinite(t),
  );
  const tMin = Math.min(...allTemps) - 2;
  const tMax = Math.max(...allTemps) + 12;

  // SVG geometry (viewBox; preserveAspectRatio non-uniform so it stretches
  // to container width on mobile but stays a fixed pixel height).
  const W = 720;
  const H = 240;
  const PAD_X = 20;
  const PAD_TOP = 56;
  const PAD_BOTTOM = 36;
  const chartW = W - 2 * PAD_X;
  const chartH = H - PAD_TOP - PAD_BOTTOM;
  const xFor = (k: number) => PAD_X + (k / HOURS) * chartW;
  const yFor = (t: number) => PAD_TOP + ((tMax - t) / (tMax - tMin || 1)) * chartH;

  const primaryPath = pathFor(primaryTemps, xFor, yFor);

  // Now line: position by sub-hour fraction.
  const nowKf = (nowMs - currentHourMs) / 3600000;
  const nowX = xFor(nowKf);

  // Hour labels every 3 hours.
  const labelKs: number[] = [0, 3, 6, 9, 12, 15, 18, 21, 24];

  // Buckets — group the 24 hours into runs of the same period. Take the
  // first 4 (which always sum to 24h regardless of starting bucket).
  const buckets = computeBuckets(times, precipProbs, tz);

  return (
    <section>
      <BucketHeader buckets={buckets} />

      <div className="relative -mx-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block h-[220px] w-full"
        >
          <defs>
            <linearGradient id="n24-edge-fade" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgba(0,0,0,1)" />
              <stop offset="6%" stopColor="rgba(0,0,0,0)" />
              <stop offset="94%" stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,1)" />
            </linearGradient>
            <mask id="n24-mask">
              <rect x="0" y="0" width={W} height={H} fill="white" />
              <rect x="0" y="0" width={W} height={H} fill="url(#n24-edge-fade)" />
            </mask>
            <filter id="n24-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
          </defs>

          {/* Now indicator */}
          {nowX >= PAD_X && nowX <= W - PAD_X && (
            <g>
              <line
                x1={nowX}
                x2={nowX}
                y1={PAD_TOP - 4}
                y2={H - PAD_BOTTOM + 4}
                stroke="currentColor"
                className="text-accent-light dark:text-accent-dark"
                strokeWidth={1.25}
                strokeDasharray="3 4"
                opacity={0.85}
              />
              <text
                x={nowX}
                y={PAD_TOP - 8}
                className="fill-accent-light dark:fill-accent-dark"
                fontSize="10"
                textAnchor="middle"
                fontWeight="600"
              >
                Now
              </text>
            </g>
          )}

          <g mask="url(#n24-mask)">
            {/* Alternate models, ghosted */}
            {showAlts &&
              altSeries.map((temps, i) => (
                <path
                  key={i}
                  d={pathFor(temps, xFor, yFor)}
                  fill="none"
                  stroke="currentColor"
                  className="text-fg-light dark:text-fg-dark"
                  strokeWidth={1.5}
                  strokeOpacity={0.3}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}

            {/* Primary line shadow + line */}
            <path
              d={primaryPath}
              fill="none"
              stroke="currentColor"
              className="text-fg-light dark:text-fg-dark"
              strokeWidth={4}
              strokeOpacity={0.25}
              strokeLinejoin="round"
              strokeLinecap="round"
              filter="url(#n24-shadow)"
            />
            <path
              d={primaryPath}
              fill="none"
              stroke="currentColor"
              className="text-fg-light dark:text-fg-dark"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>

          {/* Data points + labels (every 3rd hour gets temp + emoji) */}
          {primaryTemps.map((t, k) => {
            const cx = xFor(k);
            const cy = yFor(t);
            const labelled = k % 3 === 0 && k < HOURS;
            return (
              <g key={k}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={2.5}
                  className="fill-fg-light dark:fill-fg-dark"
                />
                {labelled && (
                  <>
                    <text
                      x={cx}
                      y={cy - 8}
                      className="fill-fg-light dark:fill-fg-dark"
                      fontSize="11"
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {Math.round(t)}°
                    </text>
                    <text
                      x={cx}
                      y={cy - 22}
                      fontSize="14"
                      textAnchor="middle"
                    >
                      {weatherEmoji(primaryCodes[k], primaryClouds[k], primaryIsDay[k])}
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Hour labels along the bottom */}
          {labelKs.map((k) => (
            <text
              key={k}
              x={xFor(k)}
              y={H - 12}
              className="fill-fg-light/50 dark:fill-fg-dark/50"
              fontSize="10"
              textAnchor="middle"
            >
              {fmtHourLabel(times[k] ?? times[times.length - 1], tz)}
            </text>
          ))}
        </svg>
      </div>

      <TogglePill showAlts={showAlts} onToggle={() => setShowAlts((s) => !s)} hasAlts={alternates.length > 0} />
    </section>
  );
}

function findHourIndex(f: Forecast, currentHourMs: number): number {
  for (let i = 0; i < f.hourly.time.length; i++) {
    if (new Date(f.hourly.time[i]).getTime() >= currentHourMs) return i;
  }
  return 0;
}

function pathFor(temps: number[], xFor: (k: number) => number, yFor: (t: number) => number): string {
  return temps
    .map((t, k) => {
      if (typeof t !== 'number' || !Number.isFinite(t)) return '';
      return `${k === 0 ? 'M' : 'L'} ${xFor(k).toFixed(1)} ${yFor(t).toFixed(1)}`;
    })
    .filter(Boolean)
    .join(' ');
}

type Bucket = { name: string; precipPct: number };

const BUCKET_NAMES: Record<string, string> = {
  evening: 'Evening',
  overnight: 'Overnight',
  morning: 'Morning',
  afternoon: 'Afternoon',
};

function bucketKey(localHour: number): string {
  if (localHour >= 18 && localHour < 21) return 'evening';
  if (localHour >= 21 || localHour < 6) return 'overnight';
  if (localHour >= 6 && localHour < 12) return 'morning';
  return 'afternoon';
}

function localHour(iso: string, tz: string | undefined): number {
  // Format the timestamp as local hour using the timezone the forecast was
  // returned in (Open-Meteo `timezone=auto`).
  const fmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: tz,
  });
  const parts = fmt.formatToParts(new Date(iso));
  const h = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const n = parseInt(h, 10);
  return n === 24 ? 0 : n;
}

function computeBuckets(times: string[], precipProbs: number[], tz: string | undefined): Bucket[] {
  const acc: { key: string; pcts: number[] }[] = [];
  for (let i = 0; i < times.length - 1; i++) {
    const k = bucketKey(localHour(times[i], tz));
    const last = acc[acc.length - 1];
    if (last && last.key === k) last.pcts.push(precipProbs[i]);
    else acc.push({ key: k, pcts: [precipProbs[i]] });
  }
  return acc.slice(0, 4).map((b) => ({
    name: BUCKET_NAMES[b.key] ?? b.key,
    precipPct: b.pcts.length ? Math.max(...b.pcts) : 0,
  }));
}

function BucketHeader({ buckets }: { buckets: Bucket[] }) {
  if (buckets.length === 0) return null;
  return (
    <div className="grid grid-cols-4 gap-1">
      {buckets.map((b, i) => (
        <div key={i} className="text-center">
          <div className="text-sm font-semibold">{b.name}</div>
          <div className="text-[11px] text-fg-light/60 dark:text-fg-dark/60">
            💧 {Math.round(b.precipPct)}%
          </div>
        </div>
      ))}
    </div>
  );
}

function TogglePill({
  showAlts,
  onToggle,
  hasAlts,
}: {
  showAlts: boolean;
  onToggle: () => void;
  hasAlts: boolean;
}) {
  if (!hasAlts) return null;
  return (
    <div className="mt-2 flex justify-center">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 rounded-full bg-card-light px-4 py-2 text-xs dark:bg-card-dark"
        aria-pressed={showAlts}
      >
        <span className={`flex items-center gap-1.5 ${showAlts ? '' : 'font-semibold'}`}>
          <Dot active={!showAlts} /> Forecast
        </span>
        <span className="h-3 w-px bg-fg-light/20 dark:bg-fg-dark/20" />
        <span className={`flex items-center gap-1.5 ${showAlts ? 'font-semibold' : 'opacity-60'}`}>
          <Dot active={showAlts} /> Alternate Predictions
        </span>
      </button>
    </div>
  );
}

function Dot({ active }: { active: boolean }) {
  return (
    <span
      className={`h-2 w-2 rounded-full ${
        active ? 'bg-accent-light dark:bg-accent-dark' : 'bg-fg-light/30 dark:bg-fg-dark/30'
      }`}
    />
  );
}

function fmtHourLabel(iso: string, tz: string | undefined): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', timeZone: tz })
    .format(new Date(iso))
    .replace(' ', '')
    .toUpperCase();
}
