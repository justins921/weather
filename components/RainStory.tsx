'use client';

import { useMemo } from 'react';
import type { PrecipHistory } from '@/lib/api';
import { fmtDayShort, fmtHourLocal } from '@/lib/format';
import type { Forecast } from '@/lib/types';

type Props = {
  forecast: Forecast;
  history: PrecipHistory | null;
};

// The Raindrop-inspired backward-and-forward precipitation view: how much
// rain has fallen recently, how much is coming, and a 14-ish-day bar strip
// so you can eyeball dry spells and wet days at a glance. If past history
// isn't available (Open-Meteo outage → MET fallback), the past-side tiles
// and past bars are omitted; the upcoming half still renders.
export default function RainStory({ forecast, history }: Props) {
  const derived = useMemo(() => computeDerived(forecast, history), [forecast, history]);

  const maxBar = Math.max(0.05, ...derived.days.map((d) => d.total));
  const todayIso = derived.days.find((d) => d.isToday)?.date ?? null;

  return (
    <section className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        Rain Story
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Next 24h" value={fmtInches(derived.next24)} />
        <Stat
          label="Past 7 days"
          value={derived.past7 !== null ? fmtInches(derived.past7) : '—'}
          sub={derived.past7 === null ? 'History unavailable' : undefined}
        />
        <Stat
          label="Peak hour"
          value={derived.peak ? fmtHourLocal(derived.peak.time) : 'None'}
          sub={derived.peak ? fmtInches(derived.peak.amount) : 'in next 24h'}
        />
      </div>

      {/* Bar strip: 7 days past (if available) + today + 7 days forecast. */}
      <div className="flex h-24 items-end justify-between gap-1">
        {derived.days.map((d) => {
          const heightPct = d.total < 0.005 ? 3 : Math.max(6, (d.total / maxBar) * 100);
          return (
            <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="mb-1 text-[9px] leading-none text-fg-light/40 dark:text-fg-dark/40">
                {d.total >= 0.05 ? fmtInchesShort(d.total) : ''}
              </div>
              <div
                className={`w-full rounded-t-sm ${barColor(d.total)} ${d.isPast ? 'opacity-60' : ''}`}
                style={{ height: `${heightPct}%` }}
                title={`${fmtDayShort(d.date)} — ${fmtInches(d.total)}`}
              />
              <div
                className={`mt-1 text-[10px] leading-none ${
                  d.date === todayIso
                    ? 'font-bold text-accent-light dark:text-accent-dark'
                    : 'text-fg-light/50 dark:text-fg-dark/50'
                }`}
              >
                {narrowDay(d.date)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-[11px] text-fg-light/60 dark:text-fg-dark/60">
        {summarySentence(derived)}
      </div>
    </section>
  );
}

type DayBar = {
  date: string;
  total: number;
  isPast: boolean;
  isToday: boolean;
};

type Derived = {
  next24: number;
  peak: { time: string; amount: number } | null;
  past7: number | null;
  dryStreakPast: number;
  wettestUpcoming: { date: string; amount: number } | null;
  days: DayBar[];
};

function computeDerived(forecast: Forecast, history: PrecipHistory | null): Derived {
  const nowMs = Date.now();

  let start = 0;
  for (let i = 0; i < forecast.hourly.time.length; i++) {
    if (new Date(forecast.hourly.time[i]).getTime() >= nowMs) {
      start = i;
      break;
    }
  }
  const end = Math.min(forecast.hourly.time.length, start + 24);
  let next24 = 0;
  let peakIdx = -1;
  let peakAmt = 0;
  for (let i = start; i < end; i++) {
    const p = forecast.hourly.precipitation[i] ?? 0;
    next24 += p;
    if (p > peakAmt) {
      peakAmt = p;
      peakIdx = i;
    }
  }

  // Match the daily arrays' "today" — first entry of daily.time is today.
  const todayIso = forecast.daily.time[0];

  const pastDates = history?.dates ?? [];
  const pastTotals = history?.totals ?? [];
  // history.dates covers past 7 + today; forecast.daily.time covers today + 7.
  // Union without duplicating today (forecast wins for today).
  const pastOnly = pastDates
    .map((date, i) => ({ date, total: pastTotals[i] ?? 0 }))
    .filter((d) => d.date !== todayIso);

  const forecastDays = forecast.daily.time.slice(0, 8).map((date, i) => ({
    date,
    total: forecast.daily.precipitation_sum[i] ?? 0,
  }));

  const days: DayBar[] = [
    ...pastOnly.map((d) => ({ ...d, isPast: true, isToday: false })),
    ...forecastDays.map((d) => ({
      ...d,
      isPast: false,
      isToday: d.date === todayIso,
    })),
  ];

  const past7 = history ? pastTotals.slice(-7).reduce((s, t) => s + (t ?? 0), 0) : null;

  // Dry streak: consecutive past days (working back from most recent past day)
  // with < 0.01 in.
  let dryStreakPast = 0;
  for (let i = pastOnly.length - 1; i >= 0; i--) {
    if (pastOnly[i].total < 0.01) dryStreakPast++;
    else break;
  }

  // Wettest upcoming (starting from today) day with actionable rain.
  let wettest: { date: string; amount: number } | null = null;
  for (const d of forecastDays) {
    if (d.total >= 0.05 && (!wettest || d.total > wettest.amount)) {
      wettest = { date: d.date, amount: d.total };
    }
  }

  return {
    next24,
    peak: peakIdx >= 0 && peakAmt >= 0.01
      ? { time: forecast.hourly.time[peakIdx], amount: peakAmt }
      : null,
    past7,
    dryStreakPast,
    wettestUpcoming: wettest,
    days,
  };
}

function summarySentence(d: Derived): string {
  const parts: string[] = [];
  if (d.dryStreakPast >= 2) {
    parts.push(`Dry streak: ${d.dryStreakPast} days`);
  }
  if (d.wettestUpcoming) {
    parts.push(
      `Wettest ahead: ${fmtDayShort(d.wettestUpcoming.date)} (${fmtInches(d.wettestUpcoming.amount)})`,
    );
  }
  if (parts.length === 0) {
    if (d.next24 < 0.01 && (d.past7 ?? 0) < 0.01) return 'Bone dry, no rain expected.';
    if (d.next24 >= 0.01 && !d.wettestUpcoming) {
      return `Light rain in the next 24h, then dry.`;
    }
    return 'No notable rain in the window.';
  }
  return parts.join(' · ');
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
      {sub && (
        <div className="text-[10px] text-fg-light/50 dark:text-fg-dark/50">{sub}</div>
      )}
    </div>
  );
}

function fmtInches(v: number): string {
  if (v < 0.005) return '0"';
  if (v < 0.1) return `${v.toFixed(2)}"`;
  return `${v.toFixed(2).replace(/0$/, '')}"`;
}

function fmtInchesShort(v: number): string {
  // Compact label above the bar. Drop the leading zero: .42 reads faster.
  if (v < 0.05) return '';
  return `.${Math.round(v * 100)
    .toString()
    .padStart(2, '0')
    .replace(/0$/, '') || '05'}`;
}

function barColor(total: number): string {
  if (total < 0.01) return 'bg-fg-light/15 dark:bg-fg-dark/15';
  if (total < 0.1) return 'bg-sky-300 dark:bg-sky-800';
  if (total < 0.5) return 'bg-sky-500 dark:bg-sky-600';
  if (total < 1) return 'bg-blue-600 dark:bg-blue-500';
  return 'bg-indigo-700 dark:bg-indigo-500';
}

function narrowDay(iso: string): string {
  // 1-char weekday initial (S M T W T F S). Uses the same UTC-forcing
  // convention as fmtDayShort so we don't shift when the browser sits in
  // a different timezone than the location.
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'narrow',
    timeZone: 'UTC',
  }).format(date);
}
