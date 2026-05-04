'use client';

import { fmtHourLocal } from '@/lib/format';
import { playability } from '@/lib/playability';
import type { Forecast } from '@/lib/types';
import { wearAdvice } from '@/lib/wear';

type Props = {
  forecast: Forecast;
};

// Find the most likely tee-time hour within the next 6 by playability score,
// then render wear advice for that hour. If you check at 9pm, this still
// surfaces tomorrow morning's recommendation.
export default function WearAdvicePanel({ forecast }: Props) {
  const h = forecast.hourly;
  const nowMs = Date.now();
  let start = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (new Date(h.time[i]).getTime() >= nowMs) {
      start = i;
      break;
    }
  }
  const window6 = Math.min(6, h.time.length - start);
  if (window6 <= 0) return null;

  let bestIdx = start;
  let bestScore = -1;
  for (let k = 0; k < window6; k++) {
    const i = start + k;
    const s = playability({
      apparent_temp: h.apparent_temperature[i],
      wind_speed: h.wind_speed_10m[i],
      wind_gusts: h.wind_gusts_10m[i],
      precip_probability: h.precipitation_probability[i] ?? 0,
      humidity: h.relative_humidity_2m[i],
      dew_point: h.dew_point_2m[i],
      cloud_cover: h.cloud_cover[i],
      is_day: h.is_day?.[i],
    }).score;
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }

  const advice = wearAdvice({
    apparent_temp: h.apparent_temperature[bestIdx],
    wind_speed: h.wind_speed_10m[bestIdx],
    wind_gusts: h.wind_gusts_10m[bestIdx],
    precip_probability: h.precipitation_probability[bestIdx] ?? 0,
    uv_index: h.uv_index[bestIdx] ?? 0,
    dew_point: h.dew_point_2m[bestIdx],
  });

  return (
    <section className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
          What to wear
        </div>
        <div className="text-[11px] text-fg-light/50 dark:text-fg-dark/50">
          for {fmtHourLocal(h.time[bestIdx], forecast.timezone)}
        </div>
      </div>
      <div className="mt-2 flex items-start gap-3">
        <span className="text-2xl leading-none">{advice.emoji}</span>
        <div className="text-sm leading-snug">
          <span className="font-semibold">{advice.headline}</span>{' '}
          <span className="text-fg-light/80 dark:text-fg-dark/80">{advice.detail}</span>
        </div>
      </div>
    </section>
  );
}
