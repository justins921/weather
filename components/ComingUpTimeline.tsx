import { fmtHourLocal, fmtTemp, isSameLocalDay, tempColor } from '@/lib/format';
import { weatherEmoji } from '@/lib/weatherCodes';
import type { Forecast } from '@/lib/types';

type Props = {
  forecast: Forecast;
};

// 12-hour temp-bar timeline with day-break divider.
export default function ComingUpTimeline({ forecast }: Props) {
  const h = forecast.hourly;
  const nowMs = Date.now();
  let start = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (new Date(h.time[i]).getTime() >= nowMs) {
      start = Math.max(0, i - 1);
      break;
    }
  }
  const end = Math.min(h.time.length, start + 12);
  const range = Array.from({ length: end - start }, (_, i) => start + i);
  const temps = range.map((i) => h.temperature_2m[i]);
  const lo = Math.min(...temps);
  const hi = Math.max(...temps);
  const span = Math.max(1, hi - lo);

  // Find day-break index (when local day changes from the first slot).
  let dayBreak = -1;
  for (let k = 1; k < range.length; k++) {
    if (!isSameLocalDay(h.time[range[0]], h.time[range[k]], forecast.timezone)) {
      dayBreak = k;
      break;
    }
  }

  const nextDayName =
    dayBreak !== -1
      ? new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          timeZone: forecast.timezone,
        }).format(new Date(h.time[range[dayBreak]]))
      : '';

  return (
    <div className="relative">
      <div className="flex items-end gap-1" style={{ height: 56 }}>
        {range.map((i, k) => {
          const t = h.temperature_2m[i];
          const heightPx = ((t - lo) / span) * 40 + 12;
          return (
            <div key={i} className="relative flex-1">
              {k === dayBreak && (
                <div className="absolute -top-2 bottom-0 left-0 w-px bg-fg-light/20 dark:bg-fg-dark/20" />
              )}
              <div
                className="rounded-t-sm"
                style={{ height: `${heightPx}px`, background: tempColor(t) }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {range.map((i, k) => (
          <div key={i} className="flex-1 text-center text-[10px] text-fg-light/60 dark:text-fg-dark/60">
            {k % 2 === 0 ? fmtHourLocal(h.time[i], forecast.timezone) : ''}
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex gap-1">
        {range.map((i, k) => (
          <div key={i} className="flex-1 text-center text-xs">
            {k % 3 === 0 ? weatherEmoji(h.weather_code[i], h.cloud_cover[i]) : ''}
          </div>
        ))}
      </div>
      {dayBreak !== -1 && (
        <div
          className="absolute top-0 -translate-y-2 rounded-full bg-fg-light/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-fg-light/70 dark:bg-fg-dark/10 dark:text-fg-dark/70"
          style={{ left: `${(dayBreak / range.length) * 100}%` }}
        >
          {nextDayName}
        </div>
      )}
      <div className="mt-2 flex justify-between text-[10px] text-fg-light/50 dark:text-fg-dark/50">
        <span>{fmtTemp(temps[0])} now</span>
        <span>peak {fmtTemp(hi)}</span>
      </div>
    </div>
  );
}
