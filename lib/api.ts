import type { Forecast, GeocodeResult, RainViewerData } from './types';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE_GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/reverse';
const RAINVIEWER_URL = 'https://api.rainviewer.com/public/weather-maps.json';

const CURRENT_VARS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'dew_point_2m',
  'cloud_cover',
  'is_day',
].join(',');

const MINUTELY_VARS = ['precipitation', 'precipitation_probability'].join(',');

const HOURLY_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'dew_point_2m',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'cloud_cover',
  'uv_index',
  'surface_pressure',
  'soil_moisture_0_to_10cm',
  'is_day',
  'visibility',
].join(',');

const DAILY_VARS = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'apparent_temperature_max',
  'apparent_temperature_min',
  'precipitation_probability_max',
  'precipitation_sum',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
  'sunrise',
  'sunset',
  'uv_index_max',
].join(',');

// Open-Meteo's free tier rate-limits aggressively when the Locations
// dashboard fans out (one card per location + course comparison row).
// Two-layer defense:
//   1. openMeteoGate caps concurrent Open-Meteo requests app-wide. With
//      7 locations × (forecast + air-quality) we'd otherwise burst ~14
//      requests in a single tick.
//   2. fetchWithRetry handles 429s that still slip through, with jittered
//      backoff so 7 stuck requests don't all retry on the same millisecond.

const MAX_CONCURRENT = 3;
let active = 0;
const waiters: Array<() => void> = [];

export function openMeteoGate<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = async () => {
      active++;
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      } finally {
        active--;
        const next = waiters.shift();
        if (next) next();
      }
    };
    if (active < MAX_CONCURRENT) run();
    else waiters.push(run);
  });
}

async function fetchWithRetry(url: string, init: RequestInit, label: string): Promise<Response> {
  const delays = [1000, 3000, 7000];
  for (let attempt = 0; attempt < delays.length + 1; attempt++) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    if (res.status !== 429 || attempt === delays.length) {
      throw new Error(`${label} failed: ${res.status}`);
    }
    const retryAfter = Number(res.headers.get('retry-after'));
    const base = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : delays[attempt];
    // Jitter prevents all parallel callers from retrying on the same tick.
    const wait = base + Math.random() * 500;
    await new Promise((r) => setTimeout(r, wait));
  }
  throw new Error(`${label} failed: exhausted retries`);
}

function buildForecastURL(lat: number, lon: number, model: 'gfs_seamless' | 'ecmwf_ifs025'): string {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: CURRENT_VARS,
    minutely_15: MINUTELY_VARS,
    hourly: HOURLY_VARS,
    daily: DAILY_VARS,
    models: model,
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto',
    forecast_days: '8',
    past_hours: '6',
  });
  return `${FORECAST_URL}?${params.toString()}`;
}

export async function fetchForecast(
  lat: number,
  lon: number,
  model: 'gfs_seamless' | 'ecmwf_ifs025' = 'gfs_seamless',
): Promise<Forecast> {
  const url = buildForecastURL(lat, lon, model);
  return openMeteoGate(async () => {
    const res = await fetchWithRetry(url, { next: { revalidate: 1800 } }, 'Forecast fetch');
    return (await res.json()) as Forecast;
  });
}

export async function fetchMinutely(lat: number, lon: number): Promise<Forecast> {
  // Same endpoint, shorter cache for 15-min nowcast freshness.
  const url = buildForecastURL(lat, lon, 'gfs_seamless');
  return openMeteoGate(async () => {
    const res = await fetchWithRetry(url, { next: { revalidate: 600 } }, 'Minutely fetch');
    return (await res.json()) as Forecast;
  });
}


export async function geocode(query: string): Promise<GeocodeResult[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({ name: query, count: '5', language: 'en', format: 'json' });
  const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: GeocodeResult[] };
  return data.results ?? [];
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  // Open-Meteo reverse geocoder. Returns a friendly name (city, then admin1)
  // or null if nothing useful comes back. Failures are non-fatal — caller falls
  // back to "Current Location".
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      count: '1',
      language: 'en',
      format: 'json',
    });
    const res = await fetch(`${REVERSE_GEOCODE_URL}?${params.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: GeocodeResult[] };
    const r = data.results?.[0];
    if (!r) return null;
    return r.name || r.admin1 || null;
  } catch {
    return null;
  }
}

export async function fetchRainViewer(): Promise<RainViewerData> {
  const res = await fetch(RAINVIEWER_URL, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error('RainViewer fetch failed');
  return (await res.json()) as RainViewerData;
}
