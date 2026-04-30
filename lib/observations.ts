'use client';

// NWS station observations — actual measured weather, US-only. We resolve
// the nearest ASOS/AWOS station once per coordinate (caches forever in-tab),
// then refetch the latest observation on a short TTL.

export type Observation = {
  stationId: string;
  observedAt: string;
  textDescription: string | null;
  temperature_f: number | null;
  apparent_temperature_f: number | null;
  dewpoint_f: number | null;
  humidity: number | null;
  wind_speed_mph: number | null;
  wind_gusts_mph: number | null;
  wind_direction: number | null;
  precipitation_last_hour_in: number | null;
  presentWeather: string[];
  isPrecipitating: boolean;
  ageMs: number;
  // Source metadata — populated by both the NWS and PWS paths. The UI uses
  // these to label the readout ("Measured at AT123 (PWS, 1.2km)").
  source?: 'nws' | 'pws';
  sourceName?: string;
  distanceKm?: number | null;
  network?: string | null;
};

const POINTS_URL = 'https://api.weather.gov/points';
const STATIONS_URL = 'https://api.weather.gov/stations';

// Fresh enough that we trust the observation over the forecast.
export const OBS_TRUST_WINDOW_MS = 90 * 60 * 1000;

const stationIdCache = new Map<string, string | null>();

async function findStationId(lat: number, lon: number): Promise<string | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (stationIdCache.has(key)) return stationIdCache.get(key)!;
  try {
    const ptsRes = await fetch(`${POINTS_URL}/${lat},${lon}`, {
      headers: { Accept: 'application/geo+json' },
    });
    if (!ptsRes.ok) {
      stationIdCache.set(key, null);
      return null;
    }
    const pts = (await ptsRes.json()) as { properties?: { observationStations?: string } };
    const stationsUrl = pts.properties?.observationStations;
    if (!stationsUrl) {
      stationIdCache.set(key, null);
      return null;
    }
    const stRes = await fetch(stationsUrl, { headers: { Accept: 'application/geo+json' } });
    if (!stRes.ok) {
      stationIdCache.set(key, null);
      return null;
    }
    const st = (await stRes.json()) as {
      features?: Array<{ properties?: { stationIdentifier?: string } }>;
    };
    const id = st.features?.[0]?.properties?.stationIdentifier ?? null;
    stationIdCache.set(key, id);
    return id;
  } catch {
    stationIdCache.set(key, null);
    return null;
  }
}

type NWSValue<T> = { value: T | null; unitCode?: string } | null | undefined;

type NWSObservation = {
  properties?: {
    timestamp?: string;
    textDescription?: string | null;
    temperature?: NWSValue<number>;
    dewpoint?: NWSValue<number>;
    heatIndex?: NWSValue<number>;
    windChill?: NWSValue<number>;
    relativeHumidity?: NWSValue<number>;
    windSpeed?: NWSValue<number>;
    windGust?: NWSValue<number>;
    windDirection?: NWSValue<number>;
    precipitationLastHour?: NWSValue<number>;
    presentWeather?: Array<{ weather?: string }>;
  };
};

function cToF(c: number | null | undefined): number | null {
  return typeof c === 'number' ? Math.round((c * 9) / 5 + 32) : null;
}
function kmhToMph(k: number | null | undefined): number | null {
  return typeof k === 'number' ? Math.round(k * 0.621371) : null;
}
function mmToIn(m: number | null | undefined): number | null {
  return typeof m === 'number' ? +(m * 0.0393701).toFixed(3) : null;
}

const PRECIP_RE = /rain|drizzle|snow|sleet|shower|thunderstorm|hail|ice/i;

// Top-level dispatcher: prefer PWS (Synoptic mesonet) when it returns a fresh
// nearby station, otherwise fall back to the NWS airport observation. PWS
// stations are typically much closer to a given course than the nearest
// ASOS/AWOS, so they win when available.
export async function fetchObservation(lat: number, lon: number): Promise<Observation | null> {
  // Lazy import keeps server-route dependencies (URL, fetch) out of any
  // server-side render path that might import this module first.
  const { fetchMesonetObservation } = await import('./mesonet');
  const meso = await fetchMesonetObservation(lat, lon);
  if (meso && meso.ageMs < OBS_TRUST_WINDOW_MS) return meso;
  return fetchNWSObservation(lat, lon);
}

export async function fetchNWSObservation(lat: number, lon: number): Promise<Observation | null> {
  const stationId = await findStationId(lat, lon);
  if (!stationId) return null;
  try {
    const res = await fetch(`${STATIONS_URL}/${stationId}/observations/latest`, {
      headers: { Accept: 'application/geo+json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as NWSObservation;
    const p = data.properties ?? {};
    const ts = p.timestamp ?? new Date().toISOString();
    const text = p.textDescription ?? null;
    const presentWeather = (p.presentWeather ?? [])
      .map((w) => w.weather ?? '')
      .filter(Boolean);
    const precipMm = p.precipitationLastHour?.value ?? null;
    const isPrecipitating =
      presentWeather.some((w) => PRECIP_RE.test(w)) ||
      (text != null && PRECIP_RE.test(text)) ||
      (typeof precipMm === 'number' && precipMm > 0);

    return {
      stationId,
      observedAt: ts,
      textDescription: text,
      temperature_f: cToF(p.temperature?.value),
      apparent_temperature_f: cToF(
        p.heatIndex?.value ?? p.windChill?.value ?? p.temperature?.value ?? null,
      ),
      dewpoint_f: cToF(p.dewpoint?.value),
      humidity: p.relativeHumidity?.value ?? null,
      wind_speed_mph: kmhToMph(p.windSpeed?.value),
      wind_gusts_mph: kmhToMph(p.windGust?.value),
      wind_direction: p.windDirection?.value ?? null,
      precipitation_last_hour_in: mmToIn(precipMm),
      presentWeather,
      isPrecipitating,
      ageMs: Date.now() - new Date(ts).getTime(),
      source: 'nws',
      sourceName: stationId,
      network: 'NWS',
    };
  } catch {
    return null;
  }
}

export function isObsRecent(obs: Observation | null): obs is Observation {
  return !!obs && obs.ageMs < OBS_TRUST_WINDOW_MS;
}

// Read the radar-derived `minutely_15.precipitation` slot that brackets "now"
// and decide whether it shows actual rain right now.
export function minutelyPrecipNow(times: string[], precip: number[]): number {
  if (!times.length) return 0;
  const nowMs = Date.now();
  let idx = 0;
  for (let i = 0; i < times.length; i++) {
    if (new Date(times[i]).getTime() >= nowMs) {
      idx = Math.max(0, i - 1);
      break;
    }
  }
  return precip[idx] ?? 0;
}
