'use client';

import type { Observation } from './observations';

// Client wrapper around the /api/pws server route. Returns the closest
// recently-reporting station shaped as an Observation so it slots into the
// existing chain. Returns null if the route isn't configured (no token) or
// no station is within range.

const PRECIP_RE = /rain|drizzle|snow|sleet|shower|thunderstorm|hail|ice/i;

type ApiStation = {
  stationId: string;
  name: string;
  network: string | null;
  distanceMi: number | null;
  observedAt: string | null;
  temperature_f: number | null;
  dewpoint_f: number | null;
  humidity: number | null;
  wind_speed_mph: number | null;
  wind_gusts_mph: number | null;
  wind_direction: number | null;
  precip_last_hour_in: number | null;
  weatherCondition: string | null;
};

type ApiResponse = { ok: true; stations: ApiStation[] } | { ok: false; reason: string };

export async function fetchMesonetObservation(lat: number, lon: number): Promise<Observation | null> {
  try {
    const res = await fetch(`/api/pws?lat=${lat}&lon=${lon}`);
    if (!res.ok) return null;
    const data = (await res.json()) as ApiResponse;
    if (!data.ok) return null;
    const stations = data.stations
      .filter((s) => s.observedAt && hasUsableData(s))
      .sort((a, b) => (a.distanceMi ?? 999) - (b.distanceMi ?? 999));
    const s = stations[0];
    if (!s || !s.observedAt) return null;
    const isPrecip =
      (s.precip_last_hour_in ?? 0) > 0 ||
      (s.weatherCondition != null && PRECIP_RE.test(s.weatherCondition));
    return {
      stationId: s.stationId,
      observedAt: s.observedAt,
      textDescription: s.weatherCondition,
      temperature_f: roundOrNull(s.temperature_f),
      // Synoptic doesn't report a feels-like; reuse temp as a baseline so the
      // UI has something measured to show. Forecast apparent_temperature is
      // a separate fall-through.
      apparent_temperature_f: roundOrNull(s.temperature_f),
      dewpoint_f: roundOrNull(s.dewpoint_f),
      humidity: roundOrNull(s.humidity),
      wind_speed_mph: roundOrNull(s.wind_speed_mph),
      wind_gusts_mph: roundOrNull(s.wind_gusts_mph),
      wind_direction: roundOrNull(s.wind_direction),
      precipitation_last_hour_in:
        s.precip_last_hour_in == null ? null : +s.precip_last_hour_in.toFixed(3),
      presentWeather: s.weatherCondition ? [s.weatherCondition] : [],
      isPrecipitating: isPrecip,
      ageMs: Date.now() - new Date(s.observedAt).getTime(),
      // Extra metadata so the UI can label the source clearly.
      source: 'pws',
      sourceName: s.name || s.stationId,
      distanceKm: s.distanceMi != null ? +(s.distanceMi * 1.60934).toFixed(1) : null,
      network: s.network,
    };
  } catch {
    return null;
  }
}

function hasUsableData(s: ApiStation): boolean {
  return (
    s.temperature_f != null ||
    s.wind_speed_mph != null ||
    s.humidity != null ||
    s.precip_last_hour_in != null
  );
}

function roundOrNull(v: number | null): number | null {
  return typeof v === 'number' ? Math.round(v) : null;
}
