'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import HourlyBars from '@/components/HourlyBars';
import HourlyStrip from '@/components/HourlyStrip';
import WearAdvicePanel from '@/components/WearAdvicePanel';
import InlineRadar from '@/components/InlineRadar';
import GolfCard from '@/components/GolfCard';
import MetricCard from '@/components/MetricCard';
import PressureTrendLine from '@/components/PressureTrendLine';
import MinutelyChart from '@/components/MinutelyChart';
import ModelAgreement from '@/components/ModelAgreement';
import WeeklyForecast from '@/components/WeeklyForecast';
import { fetchBothModels } from '@/lib/api';
import { cachedFetch } from '@/lib/clientCache';
import { fmtMph, fmtTemp } from '@/lib/format';
import { getSelectedLocation, setLocationElevation } from '@/lib/locations';
import {
  comingUpSentence,
  dewPointLabel,
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

  useEffect(() => {
    const sel = getSelectedLocation();
    setLoc(sel);
    if (!sel) return;
    let cancelled = false;
    cachedFetch(`fcboth:${sel.lat},${sel.lon}`, 30 * 60 * 1000, () =>
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
  const score = playability({
    apparent_temp: c.apparent_temperature,
    wind_speed: c.wind_speed_10m,
    wind_gusts: c.wind_gusts_10m,
    precip_probability: gfs.hourly.precipitation_probability[0] ?? 0,
    humidity: c.relative_humidity_2m,
    dew_point: c.dew_point_2m,
    cloud_cover: c.cloud_cover,
  });

  const todayUv = gfs.daily.uv_index_max[0];
  const dewExtreme = c.dew_point_2m >= 70 || c.dew_point_2m < 30;

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

      <section>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
          Right now
        </div>
        <div className="text-base">{rightNowSentence(gfs)}</div>
        <div className="mt-3 flex items-center gap-4">
          <div className="text-6xl">{weatherEmoji(c.weather_code, c.cloud_cover)}</div>
          <div>
            <div className="text-7xl font-semibold leading-none">{fmtTemp(c.temperature_2m)}</div>
            <div className="mt-1 text-sm text-fg-light/60 dark:text-fg-dark/60">
              Feels {fmtTemp(c.apparent_temperature)}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <MetricCard
            label="Wind"
            value={
              <span>
                {fmtMph(c.wind_speed_10m)} {windArrow(c.wind_direction_10m)}
              </span>
            }
            sub={`From the ${windCardinal(c.wind_direction_10m)}. Gusts to ${Math.round(c.wind_gusts_10m)}mph.`}
            footer={<PressureTrendLine forecast={gfs} />}
          />
          {dewExtreme ? (
            <MetricCard
              label="Dew Point"
              value={`${fmtTemp(c.dew_point_2m)} 💧`}
              sub={dewPointLabel(c.dew_point_2m)}
            />
          ) : (
            <MetricCard
              label="Humidity"
              value={`${Math.round(c.relative_humidity_2m)}%`}
              sub={`Dew ${fmtTemp(c.dew_point_2m)} · ${dewPointLabel(c.dew_point_2m)}`}
            />
          )}
        </div>
        <div className="mt-2">
          <GolfCard
            playability={score}
            windSpeed={c.wind_speed_10m}
            gusts={c.wind_gusts_10m}
            airInputs={{
              apparent_temp_f: c.apparent_temperature,
              elevation_ft: loc.elevation_ft ?? Math.round(gfs.elevation * 3.28084),
              surface_pressure_hpa: currentSurfacePressure(gfs),
              relative_humidity: c.relative_humidity_2m,
            }}
          />
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
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
          Coming up
        </div>
        <div className="text-base">{comingUpSentence(gfs)}</div>
        <div className="mt-3">
          <HourlyBars forecast={gfs} height={36} />
        </div>
      </section>

      <WearAdvicePanel forecast={gfs} />

      {gfs.minutely_15 && (
        <MinutelyChart minutely={gfs.minutely_15} timezone={gfs.timezone} />
      )}

      <HourlyStrip forecast={gfs} />

      <InlineRadar lat={loc.lat} lon={loc.lon} />

      <WeeklyForecast forecast={gfs} />

      {ecmwf && <ModelAgreement gfs={gfs} ecmwf={ecmwf} />}
    </div>
  );
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
