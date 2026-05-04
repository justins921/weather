'use client';

import { useMemo } from 'react';
import { findBestTeeTime } from '@/lib/bestWindow';
import { computeHourlyPlayability } from '@/lib/playability';
import { canFinishRound } from '@/lib/sunsetCalc';
import type { Forecast } from '@/lib/types';

type Props = {
  forecast: Forecast;
};

// Hero card. The single highest-priority piece of information for a
// golfer: when to tee off today. Appears at the top of the forecast
// detail page so it doesn't get buried.
export default function BestTeeTimeCard({ forecast }: Props) {
  const teeTime = useMemo(() => {
    const scores = computeHourlyPlayability(forecast, 24);
    return findBestTeeTime(scores);
  }, [forecast]);

  // Sunset for the day the suggested tee time falls on. We pick the
  // first daily.sunset entry that's after the tee start; in practice
  // that's daily index 0 or 1.
  const sunsetCheck = useMemo(() => {
    if (!teeTime) return null;
    const sunsetIso = pickSunsetForDay(forecast, teeTime.startISO);
    if (!sunsetIso) return null;
    return canFinishRound(teeTime.startISO, sunsetIso);
  }, [forecast, teeTime]);

  if (!teeTime) {
    return (
      <section className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
          ⛳ Best Tee Time Today
        </div>
        <p className="mt-2 text-sm text-fg-light/70 dark:text-fg-dark/70">
          No good golf window in the next 24 hours. Check back tomorrow.
        </p>
      </section>
    );
  }

  const badge = badgeFor(teeTime.avgScore);
  const partialAccent = teeTime.isPartial ? 'border-l-4 border-l-yellow-500' : '';

  return (
    <section
      className={`rounded-2xl bg-card-light p-4 dark:bg-card-dark ${partialAccent}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        ⛳ Best Tee Time Today
      </div>
      <div className="mt-2 font-serif text-3xl font-bold tracking-tight">
        {teeTime.startLabel} – {teeTime.endLabel}
      </div>
      <div className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: badge.color }}>
        <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
        {badge.label} · Avg {teeTime.avgScore} ·{' '}
        {teeTime.durationHours.toFixed(0)}h window
      </div>
      <p className="mt-2 text-sm text-fg-light/80 dark:text-fg-dark/80">
        {teeTime.reason}
      </p>
      {teeTime.minScore < teeTime.avgScore - 5 && (
        <p className="mt-1 text-xs text-fg-light/60 dark:text-fg-dark/60">
          Worst hour: {teeTime.minScore} at {teeTime.worstHourLabel}
        </p>
      )}
      {sunsetCheck &&
        (sunsetCheck.buffer === 'tight' || sunsetCheck.buffer === 'rushed') && (
          <p className="mt-2 text-xs text-fg-light/70 dark:text-fg-dark/70">
            ⏱ {sunsetCheck.message}
          </p>
        )}
    </section>
  );
}

function badgeFor(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Send it', color: '#22c55e' };
  if (score >= 60) return { label: 'Playable', color: '#84cc16' };
  if (score >= 40) return { label: 'Grinding', color: '#eab308' };
  if (score >= 20) return { label: 'Rough', color: '#f97316' };
  return { label: "Don't bother", color: '#ef4444' };
}

function pickSunsetForDay(f: Forecast, teeStartIso: string): string | null {
  const teeDay = teeStartIso.slice(0, 10); // YYYY-MM-DD
  // daily.sunset is parallel to daily.time; both are in location-local time.
  const sunsets = f.daily?.sunset ?? [];
  const days = f.daily?.time ?? [];
  for (let i = 0; i < days.length; i++) {
    if (days[i].slice(0, 10) === teeDay) return sunsets[i] ?? null;
  }
  return sunsets[0] ?? null;
}
