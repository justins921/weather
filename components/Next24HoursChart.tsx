'use client';

import { useEffect, useState } from 'react';
import { findBestWindow, type BestWindow } from '@/lib/bestWindow';
import {
  confidenceLabel,
  type EnsembleData,
  type EnsemblePoint,
} from '@/lib/ensemble';
import { fmtHourLocal } from '@/lib/format';
import { windArrow, windCardinal } from '@/lib/narrative';
import { playability, type PlayabilityResult } from '@/lib/playability';
import type { Forecast } from '@/lib/types';
import { weatherEmoji } from '@/lib/weatherCodes';

type Props = {
  primary: Forecast;
  ensemble?: EnsembleData;
};

export type ChartMetric = 'feels' | 'temp' | 'wind' | 'precip' | 'play';

const METRICS: { key: ChartMetric; label: string }[] = [
  { key: 'feels', label: 'Feels Like' },
  { key: 'temp', label: 'Temp' },
  { key: 'wind', label: 'Wind' },
  { key: 'precip', label: 'Precip' },
  { key: 'play', label: 'Playability' },
];

const STORAGE_KEY = 'weather.chartMetric';
const HOURS = 24;

const W = 720;
const H = 240;
const PAD_X = 20;
const PAD_TOP = 56;
const PAD_BOTTOM = 36;
const chartW = W - 2 * PAD_X;
const chartH = H - PAD_TOP - PAD_BOTTOM;

// Five metrics, one chart frame. Same x-axis (24 hours from current local
// hour), same hour labels, same Now indicator across all of them — only
// the data series, fill style, and labels change. Selection persists in
// localStorage. The confidence band toggle below the metric pills only
// matters for Feels Like / Temp; the other views ignore it.
export default function Next24HoursChart({ primary, ensemble }: Props) {
  const [metric, setMetric] = useState<ChartMetric>('feels');
  const [showBand, setShowBand] = useState(true);

  // Hydrate metric preference once on mount. Doing this in useEffect keeps
  // the server-rendered HTML matching the client's first paint.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && METRICS.some((m) => m.key === stored)) {
      setMetric(stored as ChartMetric);
    }
  }, []);

  const selectMetric = (m: ChartMetric) => {
    setMetric(m);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, m);
    }
  };

  // Snap chart start to the current local hour so the first data point
  // sits at the chart's left edge.
  const nowMs = Date.now();
  const currentHourMs = nowMs - (nowMs % 3600000);
  const startIdx = findHourIndex(primary, currentHourMs);
  if (startIdx + HOURS >= primary.hourly.time.length) return null;

  const idx = Array.from({ length: HOURS + 1 }, (_, k) => startIdx + k);
  const times = idx.map((i) => primary.hourly.time[i]);
  const tz = primary.timezone;

  const h = primary.hourly;
  const temps = idx.map((i) => h.temperature_2m[i]);
  const feels = idx.map((i) => h.apparent_temperature[i]);
  const winds = idx.map((i) => h.wind_speed_10m[i]);
  const gusts = idx.map((i) => h.wind_gusts_10m[i]);
  const windDirs = idx.map((i) => h.wind_direction_10m[i]);
  const precipProbs = idx.map((i) => h.precipitation_probability[i] ?? 0);
  const codes = idx.map((i) => h.weather_code[i]);
  const clouds = idx.map((i) => h.cloud_cover[i]);
  const isDays = idx.map((i) => h.is_day?.[i] ?? 1);

  const playScores: PlayabilityResult[] = idx.map((i) =>
    playability({
      apparent_temp: h.apparent_temperature[i],
      wind_speed: h.wind_speed_10m[i],
      wind_gusts: h.wind_gusts_10m[i],
      precip_probability: h.precipitation_probability[i] ?? 0,
      humidity: h.relative_humidity_2m[i],
      dew_point: h.dew_point_2m[i],
      cloud_cover: h.cloud_cover[i],
      is_day: h.is_day?.[i],
    }),
  );

  // Best playability window over the 24h slice (Playability view only).
  const bestWindow = findBestWindow(
    times.slice(0, HOURS).map((t, k) => ({ time: t, score: playScores[k].score })),
  );

  // Now line: position by sub-hour fraction.
  const nowKf = (nowMs - currentHourMs) / 3600000;
  const nowX = xForK(nowKf);

  // Per-bucket precip header — same as before, regardless of metric.
  const buckets = computeBuckets(times, precipProbs, tz);

  // Metric-aware summary line. Chart-internal so the parent doesn't have
  // to know which metric is active.
  const summary = summaryFor({
    metric,
    temps,
    feels,
    winds,
    gusts,
    precipProbs,
    bestWindow,
    times,
    tz,
    ensemble,
  });

  const supportsBand = metric === 'feels' || metric === 'temp';
  const ensembleSeries =
    metric === 'feels'
      ? ensemble?.apparent_temperature ?? []
      : metric === 'temp'
        ? ensemble?.temperature_2m ?? []
        : [];

  return (
    <section>
      {summary && (
        <div className="mb-3 text-base text-fg-light/80 dark:text-fg-dark/80">{summary}</div>
      )}

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
            {/* Vertical playability gradient (top=high score=green,
                bottom=low score=red). Stops mirror the playability label
                buckets in lib/playability.ts. */}
            <linearGradient id="n24-play-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="20%" stopColor="#22c55e" />
              <stop offset="20%" stopColor="#84cc16" />
              <stop offset="40%" stopColor="#84cc16" />
              <stop offset="40%" stopColor="#eab308" />
              <stop offset="60%" stopColor="#eab308" />
              <stop offset="60%" stopColor="#f97316" />
              <stop offset="80%" stopColor="#f97316" />
              <stop offset="80%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          {/* Now indicator — drawn first so layered fills don't obscure it. */}
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

          {metric === 'feels' && (
            <TempView
              values={feels}
              codes={codes}
              clouds={clouds}
              isDays={isDays}
              ensemble={ensembleSeries}
              showBand={showBand}
              times={times}
            />
          )}
          {metric === 'temp' && (
            <TempView
              values={temps}
              codes={codes}
              clouds={clouds}
              isDays={isDays}
              ensemble={ensembleSeries}
              showBand={showBand}
              times={times}
            />
          )}
          {metric === 'wind' && (
            <WindView sustained={winds} gusts={gusts} dirs={windDirs} times={times} />
          )}
          {metric === 'precip' && (
            <PrecipView probs={precipProbs} times={times} />
          )}
          {metric === 'play' && (
            <PlayView scores={playScores} bestWindow={bestWindow} times={times} />
          )}

          {/* Hour labels along the bottom — same for all metrics. */}
          {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((k) => (
            <text
              key={k}
              x={xForK(k)}
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

      <MetricPills active={metric} onChange={selectMetric} />
      {supportsBand && ensembleSeries.length > 0 && (
        <BandToggle showBand={showBand} onToggle={() => setShowBand((s) => !s)} />
      )}
    </section>
  );
}

// === Per-metric SVG bodies ==================================================

function TempView({
  values,
  codes,
  clouds,
  isDays,
  ensemble,
  showBand,
  times,
}: {
  values: number[];
  codes: number[];
  clouds: number[];
  isDays: number[];
  ensemble: EnsemblePoint[];
  showBand: boolean;
  times: string[];
}) {
  const ensembleByTime = new Map(ensemble.map((p) => [p.time, p]));
  const ensemblePts = times.map((t) => ensembleByTime.get(t) ?? null);
  const hasEnsemble = ensemble.length > 0 && ensemblePts.some((p) => p !== null);

  // Use median when available, otherwise the deterministic value.
  const lineVals = ensemblePts.map((p, k) => (p ? p.median : values[k]));
  const allTemps = [
    ...lineVals,
    ...ensemblePts.flatMap((p) => (p ? [p.p10, p.p90] : [])),
  ].filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
  const tMin = Math.min(...allTemps) - 2;
  const tMax = Math.max(...allTemps) + 12;
  const yFor = (t: number) =>
    PAD_TOP + ((tMax - t) / (tMax - tMin || 1)) * chartH;

  const linePath = pathFor(lineVals, xForK, yFor);
  const bandPath = hasEnsemble && showBand ? bandPathFor(ensemblePts, xForK, yFor) : '';

  return (
    <>
      <g mask="url(#n24-mask)">
        {bandPath && (
          <path
            d={bandPath}
            className="fill-fg-light dark:fill-fg-dark"
            fillOpacity={0.15}
            stroke="none"
          />
        )}
        <path
          d={linePath}
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
          d={linePath}
          fill="none"
          stroke="currentColor"
          className="text-fg-light dark:text-fg-dark"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>
      {lineVals.map((t, k) => {
        const cx = xForK(k);
        const cy = yFor(t);
        const labelled = k % 3 === 0 && k < HOURS;
        return (
          <g key={k}>
            <circle cx={cx} cy={cy} r={2.5} className="fill-fg-light dark:fill-fg-dark" />
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
                <text x={cx} y={cy - 22} fontSize="14" textAnchor="middle">
                  {weatherEmoji(codes[k], clouds[k], isDays[k])}
                </text>
              </>
            )}
          </g>
        );
      })}
    </>
  );
}

function WindView({
  sustained,
  gusts,
  dirs,
  times,
}: {
  sustained: number[];
  gusts: number[];
  dirs: number[];
  times: string[];
}) {
  const all = [...sustained, ...gusts].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  const vMin = Math.max(0, Math.min(...all) - 2);
  const vMax = Math.max(...all) + 8;
  const yFor = (v: number) =>
    PAD_TOP + ((vMax - v) / (vMax - vMin || 1)) * chartH;

  const sustainedPath = pathFor(sustained, xForK, yFor);
  const gustsPath = pathFor(gusts, xForK, yFor);
  const gapPath = bandBetween(sustained, gusts, xForK, yFor);

  return (
    <>
      <text
        x={PAD_X}
        y={PAD_TOP - 8}
        className="fill-fg-light/40 dark:fill-fg-dark/40"
        fontSize="10"
      >
        mph
      </text>
      <g mask="url(#n24-mask)">
        {gapPath && (
          <path
            d={gapPath}
            className="fill-fg-light dark:fill-fg-dark"
            fillOpacity={0.1}
            stroke="none"
          />
        )}
        <path
          d={gustsPath}
          fill="none"
          stroke="currentColor"
          className="text-fg-light dark:text-fg-dark"
          strokeWidth={1.5}
          strokeOpacity={0.5}
          strokeDasharray="4 4"
          strokeLinecap="round"
        />
        <path
          d={sustainedPath}
          fill="none"
          stroke="currentColor"
          className="text-fg-light dark:text-fg-dark"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>
      {sustained.map((v, k) => {
        const cx = xForK(k);
        const cy = yFor(v);
        const labelled = k % 3 === 0 && k < HOURS;
        return (
          <g key={k}>
            <circle cx={cx} cy={cy} r={2.5} className="fill-fg-light dark:fill-fg-dark" />
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
                  {Math.round(v)}/{Math.round(gusts[k])}
                </text>
                <text
                  x={cx}
                  y={cy - 22}
                  fontSize="13"
                  textAnchor="middle"
                  className="fill-fg-light dark:fill-fg-dark"
                >
                  {windArrow(dirs[k])}
                </text>
              </>
            )}
          </g>
        );
      })}
    </>
  );
}

function PrecipView({ probs, times }: { probs: number[]; times: string[] }) {
  // Fixed 0–100 range so this view's shape is comparable across days.
  const yFor = (v: number) => PAD_TOP + ((100 - v) / 100) * chartH;

  const linePath = pathFor(probs, xForK, yFor);
  const fillPath = closedAreaPath(probs, xForK, yFor, PAD_TOP + chartH);

  return (
    <>
      <g mask="url(#n24-mask)">
        <path d={fillPath} fill="#06b6d4" fillOpacity={0.6} stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke="#06b6d4"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>
      {probs.map((v, k) => {
        const cx = xForK(k);
        const cy = yFor(v);
        const labelled = k % 3 === 0 && k < HOURS;
        return (
          <g key={k}>
            <circle cx={cx} cy={cy} r={2.5} fill="#06b6d4" />
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
                  {Math.round(v)}%
                </text>
                {v > 30 && (
                  <text x={cx} y={cy - 22} fontSize="13" textAnchor="middle">
                    💧
                  </text>
                )}
              </>
            )}
          </g>
        );
      })}
    </>
  );
}

function PlayView({
  scores,
  bestWindow,
  times,
}: {
  scores: PlayabilityResult[];
  bestWindow: BestWindow | null;
  times: string[];
}) {
  const values = scores.map((s) => s.score);
  // Fixed 0–100 range so the gradient bands line up with the score buckets.
  const yFor = (v: number) => PAD_TOP + ((100 - v) / 100) * chartH;

  const linePath = pathFor(values, xForK, yFor);
  const fillPath = closedAreaPath(values, xForK, yFor, PAD_TOP + chartH);

  return (
    <>
      <g mask="url(#n24-mask)">
        <path d={fillPath} fill="url(#n24-play-grad)" fillOpacity={0.5} stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke="currentColor"
          className="text-fg-light dark:text-fg-dark"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </g>

      {/* Best window callout: thin bar above the chart, centered text. */}
      {bestWindow && (
        <g>
          <line
            x1={xForK(bestWindow.startIdx)}
            x2={xForK(bestWindow.endIdx + 1)}
            y1={PAD_TOP - 22}
            y2={PAD_TOP - 22}
            stroke="currentColor"
            className="text-accent-light dark:text-accent-dark"
            strokeWidth={2}
            strokeLinecap="round"
          />
        </g>
      )}

      {values.map((v, k) => {
        const cx = xForK(k);
        const cy = yFor(v);
        const labelled = k % 3 === 0 && k < HOURS;
        return (
          <g key={k}>
            <circle
              cx={cx}
              cy={cy}
              r={3}
              fill={scores[k].color}
              stroke="currentColor"
              strokeWidth={1}
              className="text-bg-light dark:text-bg-dark"
            />
            {labelled && (
              <text
                x={cx}
                y={cy - 8}
                className="fill-fg-light dark:fill-fg-dark"
                fontSize="11"
                textAnchor="middle"
                fontWeight="600"
              >
                {Math.round(v)}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}

// === Pills + toggle =========================================================

function MetricPills({
  active,
  onChange,
}: {
  active: ChartMetric;
  onChange: (m: ChartMetric) => void;
}) {
  return (
    <div className="no-scrollbar mt-3 -mx-1 flex gap-2 overflow-x-auto px-1">
      {METRICS.map((m) => {
        const isActive = m.key === active;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              isActive
                ? 'border-transparent bg-accent-light text-black dark:bg-accent-dark'
                : 'border-accent-light text-accent-light dark:border-accent-dark dark:text-accent-dark'
            }`}
            aria-pressed={isActive}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function BandToggle({
  showBand,
  onToggle,
}: {
  showBand: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-2 flex justify-center">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 rounded-full bg-card-light px-4 py-2 text-xs dark:bg-card-dark"
        aria-pressed={showBand}
      >
        <span className={`flex items-center gap-1.5 ${showBand ? '' : 'font-semibold'}`}>
          <Dot active={!showBand} /> Forecast
        </span>
        <span className="h-3 w-px bg-fg-light/20 dark:bg-fg-dark/20" />
        <span className={`flex items-center gap-1.5 ${showBand ? 'font-semibold' : 'opacity-60'}`}>
          <Dot active={showBand} /> Show Confidence Band
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

// === Summary line per metric ===============================================

type SummaryArgs = {
  metric: ChartMetric;
  temps: number[];
  feels: number[];
  winds: number[];
  gusts: number[];
  precipProbs: number[];
  bestWindow: BestWindow | null;
  times: string[];
  tz: string | undefined;
  ensemble?: EnsembleData;
};

function summaryFor(a: SummaryArgs): string | null {
  switch (a.metric) {
    case 'feels':
    case 'temp': {
      const series = a.metric === 'feels'
        ? a.ensemble?.apparent_temperature ?? []
        : a.ensemble?.temperature_2m ?? [];
      const note = confidenceLabel(series).message;
      const rangeText = rangeText24(a.metric === 'feels' ? a.feels : a.temps, '°');
      return [rangeText, note].filter(Boolean).join(' ');
    }
    case 'wind': {
      const peak = Math.max(...a.winds);
      const gustPeak = Math.max(...a.gusts);
      if (peak < 6 && gustPeak < 6) {
        return `Winds calm — under ${Math.max(1, Math.round(peak))}mph all day.`;
      }
      const peakIdx = a.winds.indexOf(peak);
      const tod = timeOfDay(a.times[peakIdx], a.tz);
      return `Winds ${Math.round(peak)}mph, gusts to ${Math.round(gustPeak)}mph this ${tod}.`;
    }
    case 'precip': {
      const peak = Math.max(...a.precipProbs);
      if (peak < 20) return 'Dry through next 24 hours.';
      const peakIdx = a.precipProbs.indexOf(peak);
      return `Highest chance of rain ${Math.round(peak)}% at ${fmtHourLocal(a.times[peakIdx], a.tz)}.`;
    }
    case 'play': {
      if (!a.bestWindow) return 'Conditions stay rough — no good golf window today.';
      return `Best golf window: ${fmtHourLocal(a.bestWindow.startTime, a.tz)} – ${fmtHourLocal(a.times[a.bestWindow.endIdx + 1] ?? a.bestWindow.endTime, a.tz)}, scoring ${a.bestWindow.avgScore}.`;
    }
  }
}

function rangeText24(values: number[], unit: string): string {
  const vals = values.slice(0, HOURS).filter((v) => Number.isFinite(v));
  if (vals.length === 0) return '';
  const lo = Math.round(Math.min(...vals));
  const hi = Math.round(Math.max(...vals));
  if (lo === hi) return `Steady around ${lo}${unit}.`;
  return `Ranges ${lo}${unit}–${hi}${unit} over the next 24 hours.`;
}

function timeOfDay(iso: string, tz: string | undefined): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: tz,
  });
  const h = parseInt(fmt.formatToParts(new Date(iso)).find((p) => p.type === 'hour')?.value ?? '0', 10);
  if (h >= 6 && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  if (h >= 18 && h < 21) return 'evening';
  return 'overnight';
}

// === Geometry helpers ======================================================

function xForK(k: number): number {
  return PAD_X + (k / HOURS) * chartW;
}

function findHourIndex(f: Forecast, currentHourMs: number): number {
  for (let i = 0; i < f.hourly.time.length; i++) {
    if (new Date(f.hourly.time[i]).getTime() >= currentHourMs) return i;
  }
  return 0;
}

function pathFor(
  values: number[],
  xFor: (k: number) => number,
  yFor: (t: number) => number,
): string {
  return values
    .map((t, k) => {
      if (typeof t !== 'number' || !Number.isFinite(t)) return '';
      return `${k === 0 ? 'M' : 'L'} ${xFor(k).toFixed(1)} ${yFor(t).toFixed(1)}`;
    })
    .filter(Boolean)
    .join(' ');
}

// Closed area: line across the top, then back along a baseline at the bottom.
function closedAreaPath(
  values: number[],
  xFor: (k: number) => number,
  yFor: (t: number) => number,
  baselineY: number,
): string {
  const n = values.length;
  if (n === 0) return '';
  let path = `M ${xFor(0).toFixed(1)} ${yFor(values[0]).toFixed(1)}`;
  for (let i = 1; i < n; i++) {
    path += ` L ${xFor(i).toFixed(1)} ${yFor(values[i]).toFixed(1)}`;
  }
  path += ` L ${xFor(n - 1).toFixed(1)} ${baselineY.toFixed(1)}`;
  path += ` L ${xFor(0).toFixed(1)} ${baselineY.toFixed(1)}`;
  path += ' Z';
  return path;
}

// Closed polygon spanning two parallel value series (top = high, bottom = low).
function bandBetween(
  bottom: number[],
  top: number[],
  xFor: (k: number) => number,
  yFor: (t: number) => number,
): string {
  if (bottom.length === 0 || top.length === 0) return '';
  let path = `M ${xFor(0).toFixed(1)} ${yFor(top[0]).toFixed(1)}`;
  for (let i = 1; i < top.length; i++) {
    path += ` L ${xFor(i).toFixed(1)} ${yFor(top[i]).toFixed(1)}`;
  }
  for (let i = bottom.length - 1; i >= 0; i--) {
    path += ` L ${xFor(i).toFixed(1)} ${yFor(bottom[i]).toFixed(1)}`;
  }
  path += ' Z';
  return path;
}

// Closed polygon spanning p90 across the top and p10 back along the bottom.
function bandPathFor(
  pts: (EnsemblePoint | null)[],
  xFor: (k: number) => number,
  yFor: (t: number) => number,
): string {
  const valid = pts
    .map((p, k) => (p ? { k, p } : null))
    .filter((x): x is { k: number; p: EnsemblePoint } => x !== null);
  if (valid.length < 2) return '';
  let path = '';
  valid.forEach((v, i) => {
    path += `${i === 0 ? 'M' : 'L'} ${xFor(v.k).toFixed(1)} ${yFor(v.p.p90).toFixed(1)} `;
  });
  for (let i = valid.length - 1; i >= 0; i--) {
    const v = valid[i];
    path += `L ${xFor(v.k).toFixed(1)} ${yFor(v.p.p10).toFixed(1)} `;
  }
  path += 'Z';
  return path;
}

// === Buckets ===============================================================

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

function fmtHourLabel(iso: string, tz: string | undefined): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', timeZone: tz })
    .format(new Date(iso))
    .replace(' ', '')
    .toUpperCase();
}

// Reference to satisfy unused-import paranoia in case the `windCardinal`
// helper is later picked up for the wind summary line. Currently unused.
void windCardinal;
