'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchForecast } from '@/lib/api';
import { findBestTeeTime, type TeeTime } from '@/lib/bestWindow';
import { cachedFetch } from '@/lib/clientCache';
import { fmtMph } from '@/lib/format';
import { setSelectedId } from '@/lib/locations';
import { computeHourlyPlayability } from '@/lib/playability';
import type { Forecast, Location } from '@/lib/types';

type Row = {
  loc: Location;
  forecast: Forecast | null;
  teeTime: TeeTime | null;
};

type Props = {
  locations: Location[];
};

// "Golf Course Conditions" — per-course cards matching the clean minimal
// design. Tap a card to switch active location and route to forecast.
export default function CourseComparison({ locations }: Props) {
  const [forecasts, setForecasts] = useState<Map<string, Forecast>>(new Map());
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      locations.map(async (loc) => {
        try {
          const f = await cachedFetch(`fc:${loc.lat},${loc.lon}`, 10 * 60 * 1000, () =>
            fetchForecast(loc.lat, loc.lon, 'gfs_seamless'),
          );
          return [loc.id, f] as const;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      const map = new Map<string, Forecast>();
      for (const e of entries) if (e) map.set(e[0], e[1]);
      setForecasts(map);
    });
    return () => {
      cancelled = true;
    };
  }, [locations]);

  const rows = useMemo<Row[]>(() => {
    return locations.map((loc) => {
      const f = forecasts.get(loc.id) ?? null;
      if (!f) return { loc, forecast: null, teeTime: null };
      const scores = computeHourlyPlayability(f, 24);
      return { loc, forecast: f, teeTime: findBestTeeTime(scores) };
    });
  }, [locations, forecasts]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => rank(b) - rank(a));
  }, [rows]);

  if (locations.length === 0) return null;

  const anyViable = sorted.some((r) => r.teeTime !== null);
  const visible = anyViable ? sorted.filter((r) => r.teeTime !== null) : sorted;
  const hidden = anyViable ? sorted.filter((r) => r.teeTime === null) : [];

  function pick(loc: Location) {
    setSelectedId(loc.id);
    router.push('/forecast');
  }

  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold tracking-tight">Golf Course Conditions</h2>
      <div className="mt-3 space-y-3">
        {visible.map((r) => {
          const status = statusFor(r.teeTime?.avgScore);
          return (
            <button
              key={r.loc.id}
              type="button"
              onClick={() => pick(r.loc)}
              className="card block w-full p-5 text-left"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} aria-hidden />
                  <span className="text-[15px] font-medium">{status.word}</span>
                </div>
                <span className="text-xl text-fg-light/40 dark:text-fg-dark/40" aria-hidden>
                  ⚑
                </span>
              </div>
              <div className="mt-2 text-lg font-semibold tracking-tight">{r.loc.name}</div>
              <div className="mt-0.5 flex items-end justify-between gap-3">
                <div className="text-sm text-fg-light/60 dark:text-fg-dark/60">
                  {summaryFor(r)}
                </div>
                {r.teeTime && (
                  <div className={`shrink-0 text-sm font-medium ${status.text}`}>
                    {r.teeTime.isPartial ? `Best after ${r.teeTime.startLabel}` : 'Playable now'}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {hidden.length > 0 && (
        <p className="mt-3 text-xs text-fg-light/50 dark:text-fg-dark/50">
          No window at: {hidden.map((r) => r.loc.name).join(', ')}.
        </p>
      )}
      {!anyViable && forecasts.size === locations.length && (
        <p className="mt-3 text-sm text-fg-light/70 dark:text-fg-dark/70">
          No good windows at any of your courses today. Check back tomorrow.
        </p>
      )}
    </section>
  );
}

function statusFor(score: number | undefined) {
  if (score === undefined) return { word: 'Unknown', dot: 'dot-moderate', text: 'text-fg-light/60 dark:text-fg-dark/60' };
  if (score >= 80) return { word: 'Excellent', dot: 'dot-excellent', text: 'text-green-600 dark:text-green-400' };
  if (score >= 60) return { word: 'Good', dot: 'dot-good', text: 'text-lime-600 dark:text-lime-400' };
  if (score >= 40) return { word: 'Moderate', dot: 'dot-moderate', text: 'text-yellow-600 dark:text-yellow-400' };
  if (score >= 20) return { word: 'Poor', dot: 'dot-poor', text: 'text-orange-600 dark:text-orange-400' };
  return { word: 'Bad', dot: 'dot-bad', text: 'text-red-600 dark:text-red-400' };
}

function summaryFor(r: Row): string {
  if (!r.teeTime || !r.forecast) return 'Loading…';
  const parts: string[] = [];
  // Wind at the start of the best window.
  const h = r.forecast.hourly;
  const nowMs = Date.now();
  let idx = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (new Date(h.time[i]).getTime() >= nowMs) {
      idx = Math.max(0, i - 1);
      break;
    }
  }
  const wind = h.wind_speed_10m[idx] ?? 0;
  const gusts = h.wind_gusts_10m[idx] ?? 0;
  if (wind < 5 && gusts < 10) parts.push('Light wind');
  else if (wind < 12) parts.push('Breezy');
  else parts.push('Windy');
  const precip = h.precipitation_probability[idx] ?? 0;
  if (precip < 20) parts.push('Dry');
  else if (precip < 50) parts.push('Possible rain');
  else parts.push('Rain likely');
  parts.push(`${r.teeTime.startLabel} – ${r.teeTime.endLabel}`);
  return parts.join(' · ');
}

function rank(r: Row): number {
  if (!r.teeTime) return -1000;
  const tierBonus = r.teeTime.isPartial ? 0 : 1000;
  return tierBonus + r.teeTime.avgScore;
}
