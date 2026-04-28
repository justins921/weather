'use client';

import { useState } from 'react';
import DayRow from './DayRow';
import { fmtHourLocal, fmtTemp } from '@/lib/format';
import { weeklyHeadline } from '@/lib/narrative';
import { playability } from '@/lib/playability';
import type { Forecast } from '@/lib/types';
import { weatherEmoji } from '@/lib/weatherCodes';

type Props = {
  forecast: Forecast;
};

export default function WeeklyForecast({ forecast }: Props) {
  const d = forecast.daily;
  const weekMin = Math.min(...d.temperature_2m_min);
  const weekMax = Math.max(...d.temperature_2m_max);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        Next 8 days
      </div>
      <div className="mt-1 text-base">{weeklyHeadline(d)}</div>
      <div className="mt-2 divide-y divide-black/5 dark:divide-white/5">
        {d.time.map((iso, i) => {
          const isOpen = openIdx === i;
          return (
            <div key={iso}>
              <button
                onClick={() => setOpenIdx(isOpen ? null : i)}
                className="block w-full text-left"
              >
                <DayRow
                  iso={iso}
                  timezone={forecast.timezone}
                  weatherCode={d.weather_code[i]}
                  high={d.temperature_2m_max[i]}
                  low={d.temperature_2m_min[i]}
                  precipProb={d.precipitation_probability_max[i] ?? 0}
                  weekMin={weekMin}
                  weekMax={weekMax}
                  isToday={i === 0}
                />
              </button>
              {isOpen && <DayDetail forecast={forecast} dayIndex={i} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DayDetail({ forecast, dayIndex }: { forecast: Forecast; dayIndex: number }) {
  const d = forecast.daily;
  const dayIso = d.time[dayIndex];
  const dayDate = new Date(dayIso);
  const fmt = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: forecast.timezone,
  });
  const target = fmt.format(dayDate);

  const h = forecast.hourly;
  // Pick hourly slots that fall on this local day.
  const indices = h.time
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => fmt.format(new Date(t)) === target)
    .map(({ i }) => i);

  if (indices.length === 0) {
    return (
      <div className="px-2 py-3 text-xs text-fg-light/60 dark:text-fg-dark/60">
        No hourly data available for this day.
      </div>
    );
  }

  // Compute average playability + best window.
  const scores = indices.map((i) =>
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
  const avg = Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length);
  // Best 4-hour window starting between 6am and 6pm local.
  let bestStart = -1;
  let bestAvg = -1;
  for (let k = 0; k <= indices.length - 4; k++) {
    const win = scores.slice(k, k + 4);
    const m = win.reduce((a, b) => a + b.score, 0) / 4;
    const hour = new Date(h.time[indices[k]]).getHours();
    if (hour >= 6 && hour <= 18 && m > bestAvg) {
      bestAvg = m;
      bestStart = k;
    }
  }
  const sunrise = d.sunrise[dayIndex];
  const sunset = d.sunset[dayIndex];
  const startIso = bestStart >= 0 ? h.time[indices[bestStart]] : null;
  const endIso = bestStart >= 0 ? h.time[indices[bestStart + 3]] : null;

  return (
    <div className="px-2 py-3 text-xs text-fg-light/70 dark:text-fg-dark/70">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-black/5 p-2 dark:bg-white/5">
          <div className="text-[10px] uppercase tracking-wider opacity-60">Day avg</div>
          <div className="text-sm font-semibold text-fg-light dark:text-fg-dark">
            Playability {avg}
          </div>
        </div>
        <div className="rounded-lg bg-black/5 p-2 dark:bg-white/5">
          <div className="text-[10px] uppercase tracking-wider opacity-60">Best window</div>
          <div className="text-sm font-semibold text-fg-light dark:text-fg-dark">
            {startIso && endIso
              ? `${fmtHourLocal(startIso, forecast.timezone)}–${fmtHourLocal(endIso, forecast.timezone)}`
              : '—'}
          </div>
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[11px]">
        <span>
          🌅 {fmtHourLocal(sunrise, forecast.timezone)} · 🌇 {fmtHourLocal(sunset, forecast.timezone)}
        </span>
        <span>
          High {fmtTemp(d.temperature_2m_max[dayIndex])} · Low {fmtTemp(d.temperature_2m_min[dayIndex])}
        </span>
      </div>
      <div className="no-scrollbar -mx-2 mt-2 flex gap-2 overflow-x-auto px-2">
        {indices.map((i, k) => (
          <div
            key={i}
            className="flex w-12 shrink-0 flex-col items-center rounded-lg p-1.5 text-center"
            style={{ background: `${scores[k].color}22` }}
          >
            <div className="text-[10px]">{fmtHourLocal(h.time[i], forecast.timezone)}</div>
            <div>{weatherEmoji(h.weather_code[i], h.cloud_cover[i])}</div>
            <div className="text-[11px] font-semibold text-fg-light dark:text-fg-dark">
              {fmtTemp(h.temperature_2m[i])}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
