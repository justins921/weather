'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchForecast } from '@/lib/api';
import { fetchAlerts, type Alert } from '@/lib/alerts';
import { fetchAirQuality, type AirQualityReading } from '@/lib/airQuality';
import AirQualityCard from './AirQualityCard';
import { cachedFetch } from '@/lib/clientCache';
import { fmtMph, fmtTemp } from '@/lib/format';
import { dewPointLabel, comingUpSentence, rightNowSentence, windArrow, windCardinal } from '@/lib/narrative';
import { fetchObservation, isObsRecent, type Observation } from '@/lib/observations';
import { playability } from '@/lib/playability';
import { setSelectedId, setLocationElevation } from '@/lib/locations';
import type { Forecast, Location } from '@/lib/types';
import { weatherEmoji } from '@/lib/weatherCodes';
import AlertsBanner from './AlertsBanner';
import GolfCard from './GolfCard';
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
  const [airQuality, setAirQuality] = useState<AirQualityReading | null>(null);
  const [obs, setObs] = useState<Observation | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Forecast — tightened TTL so "now" stays close to live.
    cachedFetch(`fc:${loc.lat},${loc.lon}`, 10 * 60 * 1000, () =>
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
    // NWS measured observations — ground truth for "Right now" in the US.
    cachedFetch(`obs:${loc.lat},${loc.lon}`, 5 * 60 * 1000, () =>
      fetchObservation(loc.lat, loc.lon),
    )
      .then((o) => {
        if (!cancelled) setObs(o);
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
  // When fresh NWS observations are available, prefer the measured values
  // for the displayed "current" temperature, feels-like, wind, and humidity.
  const obsFresh = isObsRecent(obs);
  const displayTemp = obsFresh && obs?.temperature_f != null ? obs.temperature_f : c.temperature_2m;
  const displayFeels =
    obsFresh && obs?.apparent_temperature_f != null
      ? obs.apparent_temperature_f
      : c.apparent_temperature;
  const displayWind =
    obsFresh && obs?.wind_speed_mph != null ? obs.wind_speed_mph : c.wind_speed_10m;
  const displayGusts =
    obsFresh && obs?.wind_gusts_mph != null ? obs.wind_gusts_mph : c.wind_gusts_10m;
  const displayWindDir =
    obsFresh && obs?.wind_direction != null ? obs.wind_direction : c.wind_direction_10m;
  const displayHumidity =
    obsFresh && obs?.humidity != null ? obs.humidity : c.relative_humidity_2m;
  const displayDew = obsFresh && obs?.dewpoint_f != null ? obs.dewpoint_f : c.dew_point_2m;

  const score = playability({
    apparent_temp: displayFeels,
    wind_speed: displayWind,
    wind_gusts: displayGusts,
    precip_probability: data.hourly.precipitation_probability[0] ?? 0,
    humidity: displayHumidity,
    dew_point: displayDew,
    cloud_cover: c.cloud_cover,
    is_day: c.is_day,
  });

  // Compact summary row — visible whether collapsed or expanded.
  // Mirrors /forecast: feels-like is the headline number, raw temp is
  // the subline.
  const summary = (
    <div className="mt-2 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="text-3xl">{weatherEmoji(c.weather_code, c.cloud_cover, c.is_day ?? 1)}</span>
        <div>
          <div className="text-2xl font-semibold leading-none">{fmtTemp(displayFeels)}</div>
          <div className="text-[11px] text-fg-light/60 dark:text-fg-dark/60">
            Actual {fmtTemp(displayTemp)}
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
          {/* Right Now sentence (with the "what's coming" sentence folded
              in, matching /forecast). The summary row above already shows
              temperature, so no need for a "Right now" header. */}
          <div className="mt-3 text-sm">
            {rightNowSentence(data, obs)} {comingUpSentence(data, alerts)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-fg-light/40 dark:text-fg-dark/40">
            {obsFresh && obs && (
              <span>
                Obs: {obs.sourceName ?? obs.stationId}
                {obs.network || typeof obs.distanceKm === 'number'
                  ? ` (${[obs.network, typeof obs.distanceKm === 'number' ? `${obs.distanceKm.toFixed(1)}km` : null].filter(Boolean).join(', ')})`
                  : ''}{' '}
                · {fmtObsTime(obs.observedAt)}
              </span>
            )}
            <a
              href={`https://www.wunderground.com/wundermap?lat=${loc.lat}&lon=${loc.lon}&zoom=11&pws=1`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-accent-light dark:text-accent-dark"
            >
              Nearby stations ↗
            </a>
          </div>

          {/* Same order as /forecast: Golf, then conditions detail, then AQ. */}
          <div className="mt-3">
            <GolfCard
              compact
              playability={score}
              windSpeed={displayWind}
              gusts={displayGusts}
              airInputs={airInputsForCurrent(data, loc, displayFeels, displayHumidity)}
              soilMoisture={currentSoilMoisture(data)}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
                Wind
              </div>
              <div className="mt-1 text-base font-semibold">
                {fmtMph(displayWind)} {windArrow(displayWindDir)}
              </div>
              <div className="text-[11px] text-fg-light/60 dark:text-fg-dark/60">
                From the {windCardinal(displayWindDir)}. Gusts to {Math.round(displayGusts)}mph.
              </div>
              <PressureTrendLine forecast={data} />
            </div>
            <div className="rounded-xl bg-black/5 p-3 dark:bg-white/5">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
                Dew Point
              </div>
              <div className="mt-1 text-base font-semibold">{fmtTemp(displayDew)} 💧</div>
              <div className="text-[11px] text-fg-light/60 dark:text-fg-dark/60">
                {dewPointLabel(displayDew)}
              </div>
            </div>
          </div>

          {airQuality && (
            <div className="mt-3">
              <AirQualityCard data={airQuality} />
            </div>
          )}

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

function fmtObsTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
    .format(new Date(iso))
    .toLowerCase()
    .replace(' ', '');
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
