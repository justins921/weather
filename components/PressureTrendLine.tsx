import { pressureArrow, pressureColor, pressureTrend } from '@/lib/pressureTrend';
import type { Forecast } from '@/lib/types';

type Props = {
  forecast: Forecast;
};

// Renders a divider + pressure trend arrow underneath the wind/club section.
// Returns null when surface_pressure data is missing or there isn't enough
// history to compute a 6-hour delta.
export default function PressureTrendLine({ forecast }: Props) {
  const h = forecast.hourly;
  if (!h.surface_pressure || h.surface_pressure.length === 0) return null;

  const nowMs = Date.now();
  let nowIdx = -1;
  for (let i = 0; i < h.time.length; i++) {
    if (new Date(h.time[i]).getTime() >= nowMs) {
      nowIdx = Math.max(0, i - 1);
      break;
    }
  }
  if (nowIdx < 0) return null;

  const sixAgoIdx = Math.max(0, nowIdx - 6);
  // If we don't actually have 6 hours of history, the trend is meaningless.
  if (nowIdx - sixAgoIdx < 1) return null;

  const current = h.surface_pressure[nowIdx];
  const sixAgo = h.surface_pressure[sixAgoIdx];
  if (typeof current !== 'number' || typeof sixAgo !== 'number') return null;

  const trend = pressureTrend(current, sixAgo);
  const color = pressureColor(trend.label);

  return (
    <>
      <div className="my-2 h-px bg-black/10 dark:bg-white/10" />
      <div className="text-[11px]" style={color ? { color } : undefined}>
        {pressureArrow(trend.direction)} {trend.label}
      </div>
    </>
  );
}
