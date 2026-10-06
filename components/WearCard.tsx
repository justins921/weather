'use client';

import { fmtHourLocal } from '@/lib/format';
import { playability } from '@/lib/playability';
import type { Forecast } from '@/lib/types';
import { wearAdvice, type WearInputs } from '@/lib/wear';
import { pollenSummary } from './PollenCard';
import { IconFor, ShirtIcon, type IconKey } from './icons';
import type { PollenForecast } from '@/lib/airQuality';

type Props = {
  forecast: Forecast;
  pollen?: PollenForecast | null;
};

// Overview tab: What to Wear as item chips (mockup style) instead of the
// text-only WearAdvicePanel. Picks the best-scoring hour in the next 6,
// same as WearAdvicePanel, then derives 3-4 clothing items from the
// conditions plus a one-line tip.
export default function WearCard({ forecast, pollen }: Props) {
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

  const inputs: WearInputs = {
    apparent_temp: h.apparent_temperature[bestIdx],
    wind_speed: h.wind_speed_10m[bestIdx],
    wind_gusts: h.wind_gusts_10m[bestIdx],
    precip_probability: h.precipitation_probability[bestIdx] ?? 0,
    uv_index: h.uv_index[bestIdx] ?? 0,
    dew_point: h.dew_point_2m[bestIdx],
    highPollen: pollenSummary(pollen ?? null).highOrAbove,
  };
  const advice = wearAdvice(inputs);
  const items = itemsFor(inputs);
  const tip = tipFor(inputs);

  return (
    <section className="card p-5" aria-label="What to wear">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-light text-lg text-white dark:bg-accent-dark"
            aria-hidden
          >
            <ShirtIcon size={18} />
          </span>
          <span className="text-lg font-semibold tracking-tight">What to Wear</span>
        </div>
        <div className="text-[11px] text-fg-light/50 dark:text-fg-dark/50">
          for {fmtHourLocal(h.time[bestIdx], forecast.timezone)}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center gap-1 rounded-xl border border-black/[0.06] px-1 py-2 text-center dark:border-white/[0.08]"
          >
            <span className="text-accent-light dark:text-accent-dark" aria-hidden>
              <IconFor icon={item.icon} size={24} />
            </span>
            <span className="text-[11px] font-medium leading-tight">{item.label}</span>
          </div>
        ))}
      </div>

      {tip && (
        <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-accent-light dark:bg-blue-950/40 dark:text-accent-dark">
          Tip: {tip}
        </div>
      )}

      <div className="mt-2 text-xs text-fg-light/60 dark:text-fg-dark/60">
        <span className="font-semibold text-fg-light dark:text-fg-dark">{advice.headline}</span>{' '}
        {advice.detail}
      </div>
    </section>
  );
}

function itemsFor(i: WearInputs): { icon: IconKey; label: string }[] {
  const t = i.apparent_temp;
  const items: { icon: IconKey; label: string }[] = [];

  // Top
  if (t < 50) items.push({ icon: 'jacket', label: 'Quarter-Zip' });
  else if (t < 67) items.push({ icon: 'shirt', label: 'Light Polo' });
  else items.push({ icon: 'shirt', label: 'Polo' });

  // Bottom
  items.push({ icon: 'pants', label: t < 67 ? 'Pants' : 'Shorts' });

  // Sun protection
  if (i.uv_index >= 3) items.push({ icon: 'glasses', label: 'Sunglasses' });
  else items.push({ icon: 'cap', label: 'Cap' });

  // Fourth slot: rain layer, wind layer, or sunscreen
  if (i.precip_probability >= 30) items.push({ icon: 'jacket', label: 'Rain Shell' });
  else if (i.wind_speed >= 15) items.push({ icon: 'wind', label: 'Wind Layer' });
  else if (i.uv_index >= 6) items.push({ icon: 'sunscreen', label: 'Sunscreen' });
  else items.push({ icon: (t < 55 ? 'glove' : 'towel') as IconKey, label: t < 55 ? 'Gloves' : 'Towel' });

  return items.slice(0, 4);
}

function tipFor(i: WearInputs): string | null {
  if (i.precip_probability >= 40) return 'Rain likely — pack the waterproofs and an extra towel.';
  if (i.wind_gusts >= 25) return 'Gusty — club down into the wind and keep the ball low.';
  if (i.uv_index >= 8) return 'High UV — reapply sunscreen at the turn.';
  if (i.apparent_temp < 45) return 'Cold round — winter gloves between shots, regular glove to swing.';
  return null;
}
