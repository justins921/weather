'use client';

import { useMemo } from 'react';
import { findBestTeeTime } from '@/lib/bestWindow';
import { computeHourlyPlayability, type PlayabilityResult } from '@/lib/playability';
import type { Forecast } from '@/lib/types';

type Props = {
  forecast: Forecast;
  score: PlayabilityResult;
  windSpeed: number;
};

// Golf-first hero card (Overview tab): playability score ring, best tee
// time today, and a one-line conditions summary. Mirrors the tabbed
// detail mockup: blue-tinted card, score ring left, text right.
export default function PlayabilityHero({ forecast, score, windSpeed }: Props) {
  const teeTime = useMemo(() => {
    const scores = computeHourlyPlayability(forecast, 24);
    return findBestTeeTime(scores);
  }, [forecast]);

  const r = 34;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, score.score / 100));

  const headline = headlineFor(score.label);
  const summary = summaryFor(forecast, windSpeed);

  return (
    <section
      className="rounded-2xl border border-accent-light/30 bg-blue-50 p-4 dark:border-accent-dark/30 dark:bg-blue-950/40"
      aria-label="Golf playability"
    >
      <div className="flex items-center gap-4">
        {/* Score ring */}
        <div className="relative h-20 w-20 shrink-0" aria-hidden>
          <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              strokeWidth="7"
              className="stroke-accent-light/20 dark:stroke-accent-dark/20"
            />
            <circle
              cx="40"
              cy="40"
              r={r}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              stroke={score.color}
              strokeDasharray={`${(frac * circ).toFixed(1)} ${circ.toFixed(1)}`}
            />
          </svg>
          <div
            className="absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums"
            style={{ color: score.color }}
          >
            {Math.round(score.score)}
          </div>
        </div>

        {/* Text */}
        <div className="min-w-0">
          <div className="text-lg font-semibold tracking-tight">
            {headline}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <span className="text-accent-light dark:text-accent-dark" aria-hidden>
              ⛳
            </span>
            {teeTime ? (
              <span>
                Best tee time today{' '}
                <span className="font-semibold">{teeTime.startLabel}</span>
              </span>
            ) : (
              <span>No good window today</span>
            )}
          </div>
          <div className="mt-1 truncate text-xs text-fg-light/60 dark:text-fg-dark/60">
            {summary}
          </div>
        </div>
      </div>
      <div className="mt-1 text-center text-[11px] text-fg-light/50 dark:text-fg-dark/50">
        Golf Playability
      </div>
    </section>
  );
}

function headlineFor(label: string): string {
  switch (label) {
    case 'Send it':
      return 'Excellent — go play';
    case 'Playable':
      return 'Good — playable round';
    case 'Grinding':
      return 'Fair — grind it out';
    case 'Rough':
      return 'Tough out there today';
    case 'After dark':
      return 'After dark — tomorrow';
    default:
      return 'Maybe stay home';
  }
}

function summaryFor(f: Forecast, windSpeed: number): string {
  const h = f.hourly;
  const nowMs = Date.now();
  let idx = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (new Date(h.time[i]).getTime() >= nowMs) {
      idx = Math.max(0, i - 1);
      break;
    }
  }
  const parts: string[] = [];
  const wind = Math.round(windSpeed);
  parts.push(wind < 8 ? 'Low wind' : wind < 15 ? `Wind ${wind} mph` : `Windy ${wind} mph`);
  const cloud = h.cloud_cover?.[idx];
  if (typeof cloud === 'number') {
    parts.push(cloud < 25 ? 'Clear skies' : cloud < 60 ? 'Partly cloudy' : 'Cloudy');
  }
  const precip = h.precipitation_probability?.[idx] ?? 0;
  parts.push(precip < 20 ? 'Dry' : `Rain ${Math.round(precip)}%`);
  return parts.join(' · ');
}
