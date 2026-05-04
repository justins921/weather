'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchForecast } from '@/lib/api';
import { findBestTeeTime, type TeeTime } from '@/lib/bestWindow';
import { cachedFetch } from '@/lib/clientCache';
import { setSelectedId } from '@/lib/locations';
import { computeHourlyPlayability } from '@/lib/playability';
import type { Forecast, Location } from '@/lib/types';

type Row = {
  loc: Location;
  teeTime: TeeTime | null;
};

type Props = {
  locations: Location[];
};

// "Where should I play today?" — per-location best-tee-time comparison.
// Surfaces the upstream question paid golf weather apps don't answer:
// not "what's the weather at MY course" but "which of MY courses is the
// best play today". Tap a row to switch active location and route to
// the forecast page.
export default function CourseComparison({ locations }: Props) {
  const [forecasts, setForecasts] = useState<Map<string, Forecast>>(new Map());
  const router = useRouter();

  // Reuse the same per-coord cache as LocationCard so we're not double-
  // fetching the same forecast for the comparison.
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
      const f = forecasts.get(loc.id);
      if (!f) return { loc, teeTime: null };
      const scores = computeHourlyPlayability(f, 24);
      return { loc, teeTime: findBestTeeTime(scores) };
    });
  }, [locations, forecasts]);

  // Sort: locations with a viable window first (by avgScore desc), then
  // partial-window locations, then no-window locations.
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      return rb - ra;
    });
  }, [rows]);

  if (locations.length === 0) return null;

  const anyViable = sorted.some((r) => r.teeTime !== null);
  if (!anyViable && forecasts.size === locations.length) {
    return (
      <section className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
          Where should I play today?
        </div>
        <p className="mt-2 text-sm text-fg-light/70 dark:text-fg-dark/70">
          No good golf windows at any of your courses today. Check back tomorrow.
        </p>
      </section>
    );
  }

  function pick(loc: Location) {
    setSelectedId(loc.id);
    router.push('/forecast');
  }

  // Filter out no-window rows in the visible list when at least one
  // viable row exists; replace them with a small footer note.
  const visible = anyViable ? sorted.filter((r) => r.teeTime !== null) : sorted;
  const hidden = anyViable ? sorted.filter((r) => r.teeTime === null) : [];

  return (
    <section className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        Where should I play today?
      </div>
      <ul className="mt-2 divide-y divide-black/10 dark:divide-white/10">
        {visible.map((r, i) => (
          <li key={r.loc.id}>
            <button
              type="button"
              onClick={() => pick(r.loc)}
              className="flex w-full items-center justify-between gap-3 py-2 text-left"
            >
              <span className="flex min-w-0 items-center gap-2">
                {i === 0 && r.teeTime && !r.teeTime.isPartial && (
                  <span aria-label="Best pick">⭐</span>
                )}
                <span className="truncate text-sm font-medium">{r.loc.name}</span>
              </span>
              {r.teeTime ? (
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-fg-light/70 dark:text-fg-dark/70">
                    {r.teeTime.startLabel} – {r.teeTime.endLabel}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                    style={{ background: badgeColor(r.teeTime.avgScore) }}
                  >
                    <span className="h-1 w-1 rounded-full bg-white/90" />
                    {r.teeTime.avgScore}
                  </span>
                  {i === 0 && !r.teeTime.isPartial && (
                    <span className="text-[10px] font-semibold uppercase text-accent-light dark:text-accent-dark">
                      Best
                    </span>
                  )}
                  {r.teeTime.isPartial && (
                    <span className="text-[10px] font-semibold uppercase text-yellow-600 dark:text-yellow-400">
                      Partial
                    </span>
                  )}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {hidden.length > 0 && (
        <p className="mt-2 text-[11px] text-fg-light/50 dark:text-fg-dark/50">
          No window at: {hidden.map((r) => r.loc.name).join(', ')}.
        </p>
      )}
    </section>
  );
}

// Sort key: full-window > partial > none, then by avg score within tier.
function rank(r: Row): number {
  if (!r.teeTime) return -1000;
  const tierBonus = r.teeTime.isPartial ? 0 : 1000;
  return tierBonus + r.teeTime.avgScore;
}

function badgeColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#84cc16';
  if (score >= 40) return '#eab308';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}
