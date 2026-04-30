'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchForecast } from '@/lib/api';
import { fetchAlerts, type Alert } from '@/lib/alerts';
import { fetchAirQuality, type AirQuality } from '@/lib/airQuality';
import { cachedFetch } from '@/lib/clientCache';
import { fmtMph, fmtTemp } from '@/lib/format';
import { dewPointLabel, comingUpSentence, rightNowSentence, windArrow, windCardinal } from '@/lib/narrative';
import { playability } from '@/lib/playability';
import { setSelectedId, setLocationElevation } from '@/lib/locations';
import type { Forecast, Location } from '@/lib/types';
import { weatherEmoji } from '@/lib/weatherCodes';
import AlertsBanner from './AlertsBanner';
import GolfCard from './GolfCard';
import HourlyBars from './HourlyBars';
import PressureTrendLine from './PressureTrendLine';

type Props = {
  loc: Location;
  expanded: boolean;
  onToggleExpand: (id: string) => void;
  onRemove: (id: string) => void;
};

export default function LocationCard({ loc, expanded, onToggleExpand, onRemove }: Props) {
  const router = useRouter();
  const [data, setData] = useState<Forecast | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [airQuality, setAirQuality] = useState<AirQuality | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    cachedFetch(`fc:${loc.lat},${loc.lon}`, 30 * 60 * 1000, () =>
      fetchForecast(loc.lat, loc.lon, 'gfs_seamless'),
    )
      .then((d) => {
        if (cancelled) return;
        setData(d);
        if (loc.elevation_ft === undefined && typeof d.elevation === 'number') {
          setLocationElevation(loc.id, d.elevation);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load');
      });
    // Alerts refresh more aggressively — severe weather changes fast.
    cachedFetch(`alerts:${loc.lat},${loc.lon}`, 5 * 60 * 1000, () =>
      fetchAlerts(loc.lat, loc.lon),
    )
      .then((a) => {
        if (!cancelled) setAlerts(a);
      })
      .catch(() => {});
    // Air quality refresh less aggressively.
    cachedFetch(`aq:${loc.lat},${loc.lon}`, 30 * 60 * 1000, () =>
      fetchAirQuality(loc.lat, loc.lon),
    )
      .then((aq) => {
        if (!cancelled) setAirQuality(aq);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [loc.lat, loc.lon, loc.id, loc.elevation_ft]);

  function navigate() {
    setSelectedId(loc.id);
    router.push('/forecast');
  }

  function toggle() {
    onToggleExpand(loc.id);
  }

  // Header chunk used by every variant — name, optional pin, expand chevron,
  // remove button. The whole header row is the toggle target.
  const header = (
    <div
      className="flex cursor-pointer items-center justify-between gap-2"
      onClick={toggle}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
    >
      <h2 className="flex min-w-0 items-center gap-1 text-lg font-semibold">
        {loc.isCurrent && (
          <span aria-label="Current location" title="Current location">
            📍
          </span>
        )}
        <span className="truncate">{loc.name}</span>
      </h2>
      <div className="flex shrink-0 items-center gap-1">
        <span
          className="text-fg-light/50 transition-transform dark:text-fg-dark/50"
          style={{ display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden
        >
          ⌄
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(loc.id);
          }}
          className="px-2 py-1 text-fg-light/40 hover:text-fg-light/80 dark:text-fg-dark/40 dark:hover:text-fg-dark/80"
          aria-label={`Remove ${loc.name}`}
        >
          ×
        </button>
      </div>
    </div>
  );

  // Error state (renders header so the user can still collapse/remove).
  if (err) {
    return (
      <div className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
        {header}
        <div className="mt-2 text-sm text-red-500">{err}</div>
      </div>
    );
  }

  // Loading state.
  if (!data) {
    return (
      <div className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
        {header}
        <div className="mt-2 text-sm text-fg-light/50 dark:text-fg-dark/50">Loading…</div>
      </div>
    );
  }

  const c = data.current;
  const score = playability({
    apparent_temp: c.apparent_temperature,
    wind_speed: c.wind_speed_10m,
    wind_gusts: c.wind_gusts_10m,
    precip_probability: data.hourly.precipitation_probability[0] ?? 0,
    humidity: c.relative_humidity_2m,
    dew_point: c.dew_point_2m,
    cloud_cover: c.cloud_cover,
  });

  // Compact summary row — visible whether collapsed or expanded.
  const summary = (
    <div className="mt-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{weatherEmoji(c.weather_code, c.cloud_cover)}</span>
        <div>
          <div className="text-2xl font-semibold leading-none">{fmtTemp(c.temperature_2m)}</div>
          <div className="text-[11px] text-fg-light/60 dark:text-fg-dark/60">
            Feels {fmtTemp(c.apparent_temperature)}
          </div>
        </div>
      </div>
      <span
        className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white"
        style={{ background: score.color }}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-white/90" /> {score.label} · {score.score}
      </span>
    </div>
  );

  return (
    <div className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
      {header}
      {alerts.length > 0 && (
        <div className="mt-2">
          <AlertsBanner alerts={alerts} compact={!expanded} />
        </div>
      )}
      {summary}

      {expanded && (
        <>
          <div className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
            Right now
          </div>
          <div className="text-sm">{rightNowSentence(data)}</div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
                Wind
              </div>
              <div className="mt-1 text-base font-semibold">
                {fmtMph(c.wind_speed_10m)} {windArrow(c.wind_direction_10m)}
              </div>
              <div className="text-[11px] text-fg-light/60 dark:text-fg-dark/60">
                From the {windCardinal(c.wind_direction_10m)}. Gusts to {Math.round(c.wind_gusts_10m)}mph.
              </div>
              <PressureTrendLine forecast={data} />
            </div>
            <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
                Dew Point
              </div>
              <div className="mt-1 text-base font-semibold">{fmtTemp(c.dew_point_2m)} 💧</div>
              <div className="text-[11px] text-fg-light/60 dark:text-fg-dark/60">
                {dewPointLabel(c.dew_point_2m)}
              </div>
            </div>
          </div>

          <div className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
            Coming up
          </div>
          <div className="text-sm">{comingUpSentence(data)}</div>

          <div className="mt-3">
            <HourlyBars forecast={data} height={28} />
          </div>

          <div className="mt-4">
            <GolfCard
              compact
              playability={score}
              windSpeed={c.wind_speed_10m}
              gusts={c.wind_gusts_10m}
              airInputs={airInputsForCurrent(data, loc, c.apparent_temperature, c.relative_humidity_2m)}
              soilMoisture={currentSoilMoisture(data)}
              airQuality={airQuality}
            />
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate();
            }}
            className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent-light dark:text-accent-dark"
          >
            View detailed forecast →
          </button>
        </>
      )}
    </div>
  );
}

// Same idea as airInputsForCurrent but for soil moisture.
function currentSoilMoisture(data: Forecast): number | undefined {
  const arr = data.hourly.soil_moisture_0_to_10cm;
  if (!arr) return undefined;
  const nowMs = Date.now();
  let idx = 0;
  for (let i = 0; i < data.hourly.time.length; i++) {
    if (new Date(data.hourly.time[i]).getTime() >= nowMs) {
      idx = Math.max(0, i - 1);
      break;
    }
  }
  return arr[idx];
}

// Resolve the air-density inputs for "now" — pulls surface_pressure from the
// hourly slot that brackets the current time so past_hours doesn't pollute
// the value.
function airInputsForCurrent(
  data: Forecast,
  loc: Location,
  apparent: number,
  humidity: number,
) {
  const nowMs = Date.now();
  let pIdx = 0;
  for (let i = 0; i < data.hourly.time.length; i++) {
    if (new Date(data.hourly.time[i]).getTime() >= nowMs) {
      pIdx = Math.max(0, i - 1);
      break;
    }
  }
  return {
    apparent_temp_f: apparent,
    elevation_ft: loc.elevation_ft ?? Math.round(data.elevation * 3.28084),
    surface_pressure_hpa: data.hourly.surface_pressure?.[pIdx] ?? 1013,
    relative_humidity: humidity,
  };
}
