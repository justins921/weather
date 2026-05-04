'use client';

import {
  categoryStyle,
  isWildfireRisk,
  type AirQualityReading,
} from '@/lib/airQuality';

type Props = {
  data: AirQualityReading | null;
};

// Full-size card: current AQI + category + dominant pollutant + station,
// with a trend arrow + peak/min line underneath when hourly data is
// available. PM2.5 above 100 also surfaces a wildfire-smoke banner above
// the card, since you'll be outside for 4+ hours during a round.
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

  const trendLine = trendDescription(data);

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
        {trendLine && (
          <>
            <div className="my-2 h-px bg-black/10 dark:bg-white/10" />
            <div
              className="flex items-center gap-1.5 text-xs"
              style={trendLine.color ? { color: trendLine.color } : undefined}
            >
              <span aria-hidden>{trendLine.arrow}</span>
              <span>{trendLine.text}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function trendDescription(
  data: AirQualityReading,
): { arrow: string; text: string; color: string | null } | null {
  if (data.hourly.length === 0) return null;
  if (data.trend === 'worsening' && data.trendPeak) {
    return {
      arrow: '↗',
      text: `Worsening — peaks at AQI ${data.trendPeak.aqi} by ${fmtTime(data.trendPeak.time)}`,
      color: '#f97316',
    };
  }
  if (data.trend === 'improving' && data.trendMin) {
    return {
      arrow: '↘',
      text: `Improving — drops to AQI ${data.trendMin.aqi} by ${fmtTime(data.trendMin.time)}`,
      color: '#22c55e',
    };
  }
  return { arrow: '→', text: 'Stable through the day', color: null };
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric' })
    .format(new Date(iso))
    .toLowerCase()
    .replace(' ', '');
}
