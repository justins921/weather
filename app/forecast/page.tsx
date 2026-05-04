'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import HourlyBars from '@/components/HourlyBars';
import ForecastDiscussion from '@/components/ForecastDiscussion';
import HourlyStrip from '@/components/HourlyStrip';
import Next24HoursChart from '@/components/Next24HoursChart';
import WearAdvicePanel from '@/components/WearAdvicePanel';
import InlineRadar from '@/components/InlineRadar';
import AlertsBanner from '@/components/AlertsBanner';
import GolfCard from '@/components/GolfCard';
import MetricCard from '@/components/MetricCard';
import PressureTrendLine from '@/components/PressureTrendLine';
import MinutelyChart from '@/components/MinutelyChart';
import WeeklyForecast from '@/components/WeeklyForecast';
import { fetchBothModels } from '@/lib/api';
import { fetchAlerts, type Alert } from '@/lib/alerts';
import { fetchAirQuality, type AirQualityReading } from '@/lib/airQuality';
import AirQualityCard from '@/components/AirQualityCard';
import { fetchObservation, isObsRecent, type Observation } from '@/lib/observations';
import { cachedFetch } from '@/lib/clientCache';
import { fmtMph, fmtTemp } from '@/lib/format';
import { getSelectedLocation, setLocationElevation } from '@/lib/locations';
import {
  comingUpSentence,
  dewPointLabel,
  modelAgreementNote,
  rightNowSentence,
  windArrow,
  windCardinal,
} from '@/lib/narrative';
import { playability } from '@/lib/playability';
import type { Forecast, Location } from '@/lib/types';
import { weatherEmoji } from '@/lib/weatherCodes';

export default function ForecastPage() {
  const [loc, setLoc] = useState<Location | null>(null);
  const [gfs, setGfs] = useState<Forecast | null>(null);
  const [ecmwf, setEcmwf] = useState<Forecast | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [airQuality, setAirQuality] = useState<AirQualityReading | null>(null);
  const [obs, setObs] = useState<Observation | null>(null);

  useEffect(() => {
    const sel = getSelectedLocation();
    setLoc(sel);
    if (!sel) return;
    let cancelled = false;
    cachedFetch(`fcboth:${sel.lat},${sel.lon}`, 10 * 60 * 1000, () =>
      fetchBothModels(sel.lat, sel.lon),
    )
      .then(({ gfs: g, ecmwf: e }) => {
        if (cancelled) return;
        setGfs(g);
        setEcmwf(e);
        if (sel.elevation_ft === undefined && typeof g.elevation === 'number') {
          setLocationElevation(sel.id, g.elevation);
        }
      })
      .catch(() => {});
    cachedFetch(`alerts:${sel.lat},${sel.lon}`, 5 * 60 * 1000, () =>
      fetchAlerts(sel.lat, sel.lon),
    )
      .then((a) => {
        if (!cancelled) setAlerts(a);
      })
      .catch(() => {});
    cachedFetch(`obs:${sel.lat},${sel.lon}`, 5 * 60 * 1000, () =>
      fetchObservation(sel.lat, sel.lon),
    )
      .then((o) => {
        if (!cancelled) setObs(o);
      })
      .catch(() => {});
    cachedFetch(`aq:${sel.lat},${sel.lon}`, 30 * 60 * 1000, () =>
      fetchAirQuality(sel.lat, sel.lon),
    )
      .then((aq) => {
        if (!cancelled) setAirQuality(aq);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loc) {
    return (
      <div className="px-4 pt-6">
        <h1 className="text-2xl font-bold">Forecast</h1>
        <p className="mt-4 text-sm text-fg-light/60 dark:text-fg-dark/60">
          Pick a location from the <Link className="underline" href="/">Locations</Link> tab to see
          its forecast.
        </p>
      </div>
    );
  }

  if (!gfs) {
    return (
      <div className="px-4 pt-6">
        <h1 className="text-2xl font-bold">{loc.name}</h1>
        <p className="mt-4 text-sm text-fg-light/60 dark:text-fg-dark/60">Loading…</p>
      </div>
    );
  }

  const c = gfs.current;
  // Prefer NWS observations when fresh — measured beats modelled.
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
    precip_probability: gfs.hourly.precipitation_probability[0] ?? 0,
    humidity: displayHumidity,
    dew_point: displayDew,
    cloud_cover: c.cloud_cover,
  });

  const todayUv = gfs.daily.uv_index_max[0];
  const dewExtreme = displayDew >= 70 || displayDew < 30;

  function share() {
    const url = window.location.href;
    if (navigator.share) {
      void navigator.share({ title: loc!.name, url });
    } else {
      void navigator.clipboard.writeText(url);
    }
  }

  return (
    <div className="space-y-5 px-4 pt-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{loc.name}</h1>
        <button
          onClick={share}
          className="rounded-full bg-card-light px-3 py-1 text-xs dark:bg-card-dark"
          aria-label="Share"
        >
          ↗ Share
        </button>
      </header>

      {alerts.length > 0 && <AlertsBanner alerts={alerts} />}

      <section>
        <div className="font-serif text-2xl font-bold tracking-tight">Right now</div>
        <div className="mt-1 text-base">{rightNowSentence(gfs, obs)}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-light/40 dark:text-fg-dark/40">
          {obsFresh && obs && (
            <span>
              Measured at {obs.sourceName ?? obs.stationId}
              {obsSourceLabel(obs)} · {fmtObsTime(obs.observedAt)}
            </span>
          )}
          <a
            href={`https://www.wunderground.com/wundermap?lat=${loc.lat}&lon=${loc.lon}&zoom=11&pws=1`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-light dark:text-accent-dark"
          >
            Nearby stations ↗
          </a>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <div className="text-6xl">{weatherEmoji(c.weather_code, c.cloud_cover)}</div>
          <div>
            <div className="text-7xl font-semibold leading-none">{fmtTemp(displayTemp)}</div>
            <div className="mt-1 text-sm text-fg-light/60 dark:text-fg-dark/60">
              Feels {fmtTemp(displayFeels)}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <MetricCard
            label="Wind"
            value={
              <span>
                {fmtMph(displayWind)} {windArrow(displayWindDir)}
              </span>
            }
            sub={`From the ${windCardinal(displayWindDir)}. Gusts to ${Math.round(displayGusts)}mph.`}
            footer={<PressureTrendLine forecast={gfs} />}
          />
          {dewExtreme ? (
            <MetricCard
              label="Dew Point"
              value={`${fmtTemp(displayDew)} 💧`}
              sub={dewPointLabel(displayDew)}
            />
          ) : (
            <MetricCard
              label="Humidity"
              value={`${Math.round(displayHumidity)}%`}
              sub={`Dew ${fmtTemp(displayDew)} · ${dewPointLabel(displayDew)}`}
            />
          )}
        </div>
        <div className="mt-2">
          <GolfCard
            playability={score}
            windSpeed={displayWind}
            gusts={displayGusts}
            airInputs={{
              apparent_temp_f: displayFeels,
              elevation_ft: loc.elevation_ft ?? Math.round(gfs.elevation * 3.28084),
              surface_pressure_hpa: currentSurfacePressure(gfs),
              relative_humidity: displayHumidity,
            }}
            soilMoisture={currentHourlyValue(gfs, 'soil_moisture_0_to_10cm')}
          />
        </div>
        <div className="mt-2">
          <AirQualityCard data={airQuality} />
        </div>
        {todayUv > 5 && (
          <div className="mt-2">
            <MetricCard
              label="UV Index Today"
              value={`${Math.round(todayUv)}`}
              sub={uvAdvice(todayUv)}
            />
          </div>
        )}
      </section>

      <section>
        <div className="font-serif text-2xl font-bold tracking-tight">Coming up</div>
        <div className="mt-1 text-base">
          {comingUpSentence(gfs, alerts)}
          {(() => {
            const note = modelAgreementNote(gfs, ecmwf);
            return note ? ` ${note}` : '';
          })()}
        </div>
        <div className="mt-3">
          <HourlyBars forecast={gfs} height={36} />
        </div>
      </section>

      <WearAdvicePanel forecast={gfs} />

      {gfs.minutely_15 && (
        <MinutelyChart minutely={gfs.minutely_15} timezone={gfs.timezone} />
      )}

      <HourlyStrip forecast={gfs} />

      <section>
        <div className="font-serif text-2xl font-bold tracking-tight">Next 24 Hours</div>
        <div className="mt-3">
          <Next24HoursChart primary={gfs} alternates={ecmwf ? [ecmwf] : []} />
        </div>
      </section>

      <ForecastDiscussion lat={loc.lat} lon={loc.lon} />

      <InlineRadar lat={loc.lat} lon={loc.lon} />

      <WeeklyForecast forecast={gfs} />
    </div>
  );
}

function fmtObsTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
    .format(new Date(iso))
    .toLowerCase()
    .replace(' ', '');
}

function obsSourceLabel(obs: Observation): string {
  const parts: string[] = [];
  if (obs.network) parts.push(obs.network);
  if (typeof obs.distanceKm === 'number') parts.push(`${obs.distanceKm.toFixed(1)}km`);
  return parts.length ? ` (${parts.join(', ')})` : '';
}

function currentHourlyValue<K extends keyof Forecast['hourly']>(
  f: Forecast,
  key: K,
): number | undefined {
  const arr = f.hourly[key];
  if (!Array.isArray(arr)) return undefined;
  const nowMs = Date.now();
  let idx = 0;
  for (let i = 0; i < f.hourly.time.length; i++) {
    if (new Date(f.hourly.time[i]).getTime() >= nowMs) {
      idx = Math.max(0, i - 1);
      break;
    }
  }
  return arr[idx] as number | undefined;
}

function currentSurfacePressure(f: Forecast): number {
  // Find the hourly index closest to (and not after) "now" and read its
  // surface_pressure. Open-Meteo includes past_hours in the array, so the
  // first entry may be 6 hours ago — we still want the current bucket.
  const nowMs = Date.now();
  let idx = 0;
  for (let i = 0; i < f.hourly.time.length; i++) {
    if (new Date(f.hourly.time[i]).getTime() >= nowMs) {
      idx = Math.max(0, i - 1);
      break;
    }
  }
  return f.hourly.surface_pressure?.[idx] ?? 1013;
}

function uvAdvice(uv: number): string {
  if (uv >= 11) return 'Extreme. Cover up.';
  if (uv >= 8) return 'Very high. Sunscreen + hat.';
  if (uv >= 6) return 'High. Sunscreen recommended.';
  return 'Moderate.';
}
