'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ForecastDiscussion from '@/components/ForecastDiscussion';
import HourlyStrip from '@/components/HourlyStrip';
import Next24HoursChart from '@/components/Next24HoursChart';
import RainStory from '@/components/RainStory';
import WearAdvicePanel from '@/components/WearAdvicePanel';
import WearCard from '@/components/WearCard';
import InlineRadar from '@/components/InlineRadar';
import AlertsBanner from '@/components/AlertsBanner';
import BestTeeTimeCard from '@/components/BestTeeTimeCard';
import SunsetCheckWidget from '@/components/SunsetCheckWidget';
import GolfCard from '@/components/GolfCard';
import PlayabilityHero from '@/components/PlayabilityHero';
import OverviewStats from '@/components/OverviewStats';
import MinutelyChart from '@/components/MinutelyChart';
import WeeklyForecast from '@/components/WeeklyForecast';
import { fetchForecast, fetchPrecipHistory, type PrecipHistory } from '@/lib/api';
import { fetchAlerts, type Alert } from '@/lib/alerts';
import { fetchAirQuality, type AirQualityReading } from '@/lib/airQuality';
import PollenCard from '@/components/PollenCard';
import { fetchEnsemble, type EnsembleData } from '@/lib/ensemble';
import { fetchObservation, isObsRecent, type Observation } from '@/lib/observations';
import { cachedFetch } from '@/lib/clientCache';
import { fmtTemp } from '@/lib/format';
import { getSelectedLocation, setLocationElevation } from '@/lib/locations';
import { comingUpSentence, rightNowSentence } from '@/lib/narrative';
import { playability } from '@/lib/playability';
import type { Forecast, Location } from '@/lib/types';
import { weatherEmoji, weatherLabel } from '@/lib/weatherCodes';

type Tab = 'overview' | 'hourly' | 'daily' | 'golf';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'hourly', label: 'Hourly' },
  { key: 'daily', label: 'Daily' },
  { key: 'golf', label: 'Golf' },
];

export default function ForecastPage() {
  const [loc, setLoc] = useState<Location | null>(null);
  const [gfs, setGfs] = useState<Forecast | null>(null);
  const [ensemble, setEnsemble] = useState<EnsembleData>({
    temperature_2m: [],
    apparent_temperature: [],
  });
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [airQuality, setAirQuality] = useState<AirQualityReading | null>(null);
  const [obs, setObs] = useState<Observation | null>(null);
  const [precipHistory, setPrecipHistory] = useState<PrecipHistory | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    const sel = getSelectedLocation();
    setLoc(sel);
    if (!sel) return;
    let cancelled = false;
    cachedFetch(`fc:${sel.lat},${sel.lon}`, 10 * 60 * 1000, () =>
      fetchForecast(sel.lat, sel.lon, 'gfs_seamless'),
    )
      .then((g) => {
        if (cancelled) return;
        setGfs(g);
        if (sel.elevation_ft === undefined && typeof g.elevation === 'number') {
          setLocationElevation(sel.id, g.elevation);
        }
      })
      .catch(() => {});
    cachedFetch(`ens:${sel.lat},${sel.lon}`, 30 * 60 * 1000, () =>
      fetchEnsemble(sel.lat, sel.lon),
    )
      .then((e) => {
        if (!cancelled) setEnsemble(e);
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
    cachedFetch(`ph:${sel.lat},${sel.lon}`, 60 * 60 * 1000, () =>
      fetchPrecipHistory(sel.lat, sel.lon),
    )
      .then((h) => {
        if (!cancelled) setPrecipHistory(h);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loc) {
    return (
      <div className="px-4 pt-6">
        <h1 className="text-2xl font-semibold tracking-tight">Forecast</h1>
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
        <h1 className="text-2xl font-semibold tracking-tight">{loc.name}</h1>
        <p className="mt-4 text-sm text-fg-light/60 dark:text-fg-dark/60">Loading…</p>
      </div>
    );
  }

  const c = gfs.current;
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
    is_day: c.is_day,
  });

  const todayUv = gfs.daily.uv_index_max[0];
  const condition = weatherLabel(c.weather_code, c.cloud_cover);

  function share() {
    const url = window.location.href;
    if (navigator.share) {
      void navigator.share({ title: loc!.name, url });
    } else {
      void navigator.clipboard.writeText(url);
    }
  }

  const minutely = gfs.minutely_15;
  const expectingPrecip = !!minutely?.precipitation
    ?.slice(0, 24)
    .some((p) => typeof p === 'number' && p > 0.005);

  return (
    <div className="pb-6">
      {/* Sticky compact header */}
      <header className="sticky top-0 z-20 border-b border-black/[0.06] bg-bg-light/90 backdrop-blur dark:border-white/[0.08] dark:bg-bg-dark/90">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="text-xl text-accent-light dark:text-accent-dark"
            aria-label="Back to locations"
          >
            ‹
          </Link>
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {loc.name}{' '}
            <span className="font-normal text-fg-light/50 dark:text-fg-dark/50">
              {fmtTemp(displayFeels)}
            </span>
          </h1>
          <button
            onClick={share}
            className="text-accent-light dark:text-accent-dark"
            aria-label="More options"
          >
            <span className="text-xl tracking-widest" aria-hidden>
              •••
            </span>
          </button>
        </div>
        {/* Tab bar */}
        <nav className="flex px-4" role="tablist" aria-label="Forecast sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 border-b-2 pb-2 text-[15px] ${
                tab === t.key
                  ? 'border-accent-light font-semibold text-accent-light dark:border-accent-dark dark:text-accent-dark'
                  : 'border-transparent text-fg-light/50 dark:text-fg-dark/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="px-4 pt-4">
        {alerts.length > 0 && (
          <div className="mb-4">
            <AlertsBanner alerts={alerts} />
          </div>
        )}

        {tab === 'overview' && (
          <div className="space-y-5">
            {/* Hero temp */}
            <section>
              <div className="flex items-start justify-center">
                <div className="temp-hero">{fmtTemp(displayFeels)}</div>
                <span className="mt-6 text-4xl" aria-hidden>
                  {weatherEmoji(c.weather_code, c.cloud_cover, c.is_day ?? 1)}
                </span>
              </div>
              <div className="mt-1 text-center text-[15px] text-fg-light/60 dark:text-fg-dark/60">
                {condition} · Feels like {fmtTemp(displayFeels)}
              </div>
              <div className="mt-1 text-center text-xs text-fg-light/50 dark:text-fg-dark/50">
                {rightNowSentence(gfs, obs)} {comingUpSentence(gfs, alerts)}
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-fg-light/40 dark:text-fg-dark/40">
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
            </section>

            <PlayabilityHero forecast={gfs} score={score} windSpeed={displayWind} />

            <OverviewStats
              forecast={gfs}
              windSpeed={displayWind}
              windDir={displayWindDir}
              windGusts={displayGusts}
              humidity={displayHumidity}
              dewPoint={displayDew}
              uvMax={todayUv}
              airQuality={airQuality}
            />

            <WearCard forecast={gfs} pollen={airQuality?.pollen ?? null} />

            <PollenCard pollen={airQuality?.pollen ?? null} timezone={gfs.timezone} />

            <InlineRadar lat={loc.lat} lon={loc.lon} />
          </div>
        )}

        {tab === 'hourly' && (
          <div className="space-y-5">
            <section>
              <div className="text-xl font-semibold tracking-tight">Next 24 Hours</div>
              <div className="mt-3">
                <Next24HoursChart primary={gfs} ensemble={ensemble} />
              </div>
            </section>
            {expectingPrecip && minutely && (
              <MinutelyChart minutely={minutely} timezone={gfs.timezone} />
            )}
            <HourlyStrip forecast={gfs} />
          </div>
        )}

        {tab === 'daily' && (
          <div className="space-y-5">
            <WeeklyForecast forecast={gfs} />
            <RainStory forecast={gfs} history={precipHistory} />
            <ForecastDiscussion lat={loc.lat} lon={loc.lon} />
          </div>
        )}

        {tab === 'golf' && (
          <div className="space-y-5">
            <SunsetCheckWidget forecast={gfs} />
            <BestTeeTimeCard forecast={gfs} />
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
            <WearAdvicePanel forecast={gfs} pollen={airQuality?.pollen ?? null} />
          </div>
        )}
      </div>
    </div>
  );
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

function currentSurfacePressure(f: Forecast): number {  const nowMs = Date.now();
  let idx = 0;
  for (let i = 0; i < f.hourly.time.length; i++) {
    if (new Date(f.hourly.time[i]).getTime() >= nowMs) {
      idx = Math.max(0, i - 1);
      break;
    }
  }
  return f.hourly.surface_pressure?.[idx] ?? 1013;
}
