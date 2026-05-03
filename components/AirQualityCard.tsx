'use client';

import {
  categoryStyle,
  isWildfireRisk,
  type AirQualityReading,
} from '@/lib/airQuality';

type Props = {
  data: AirQualityReading | null;
};

// Full-size card for /forecast (and the LocationCard expanded view). Always
// renders when data is available, regardless of whether AQ is good or bad —
// the user explicitly asked for transparency. When PM2.5 is elevated, a
// wildfire-smoke warning is rendered above the card.
export default function AirQualityCard({ data }: Props) {
  if (!data) return null;
  const style = categoryStyle(data.category);
  const wildfire = isWildfireRisk(data);

  const subtitle = data.modeled
    ? 'Open-Meteo estimate'
    : [data.parameter, data.reportingArea].filter(Boolean).join(' · ');

  const valueText = data.modeled
    ? `${data.aqi} · ${style.label} (modeled)`
    : `${data.aqi} · ${style.label}`;

  return (
    <div className="space-y-2">
      {wildfire && (
        <div
          className="rounded-xl px-3 py-2 text-sm text-white"
          style={{ background: '#ea580c' }}
          role="alert"
        >
          🔥 Elevated PM2.5 — possible wildfire smoke. Limit outdoor exposure.
        </div>
      )}
      <div className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
          Air Quality
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xl font-semibold">{valueText}</span>
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: style.color }}
            aria-label={style.label}
          />
        </div>
        {subtitle && (
          <div className="mt-1 text-xs text-fg-light/60 dark:text-fg-dark/60">{subtitle}</div>
        )}
      </div>
    </div>
  );
}
