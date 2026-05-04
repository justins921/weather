'use client';

// Air quality. Two complementary sources:
//   1. EPA AirNow (real monitoring stations, US-only). Server-proxied via
//      /api/airnow so the API key stays out of the client bundle. Used
//      for the "current" AQI value when a station is in range.
//   2. Open-Meteo CAMS (hourly forecast, global). Used for:
//        - hourly trajectory + trend / peak
//        - pollen forecast (per-species, every hour)
//        - fallback current value when AirNow has no nearby station
//
// Both run in parallel; the resulting AirQualityReading carries data from
// whichever sources resolved.

export type AirNowReading = {
  parameter: string;
  aqi: number;
  category: string;
  reportingArea: string;
};

export type PollenLevel = 'none' | 'low' | 'moderate' | 'high' | 'very-high';
export type PollenSpecies = 'alder' | 'birch' | 'grass' | 'mugwort' | 'olive' | 'ragweed';

export type PollenReading = {
  type: PollenSpecies;
  value: number;
  level: PollenLevel;
};

export type PollenForecast = {
  current: PollenReading[]; // current-hour reading per species
  peak24h: PollenReading[]; // highest value per species over the next 24 h
  peakTime: string | null; // ISO time of the dominant species' peak
};

export type AQHourly = {
  time: string;
  aqi: number;
  pm25: number;
  ozone: number;
};

export type AQTrend = 'improving' | 'worsening' | 'stable';

export type AirQualityReading = {
  source: 'airnow' | 'open-meteo';
  modeled: boolean;
  aqi: number;
  category: string;
  parameter: string | null;
  reportingArea: string | null;

  // Hourly trajectory (from Open-Meteo). Empty array if Open-Meteo failed.
  hourly: AQHourly[];

  // Trend over the next 6 hours, derived from `hourly`.
  trend: AQTrend;
  trendPeak: { aqi: number; time: string } | null;
  trendMin: { aqi: number; time: string } | null;

  pollen: PollenForecast | null;
  readings?: AirNowReading[];
};

// EPA's six standard categories. Reused for AirNow's `Category.Name` and
// also synthesized from a numeric AQI for the Open-Meteo modelled fallback.
export type CategoryStyle = { color: string; label: string };

export function categoryStyle(category: string): CategoryStyle {
  switch (category) {
    case 'Good':
      return { color: '#22c55e', label: 'Good' };
    case 'Moderate':
      return { color: '#eab308', label: 'Moderate' };
    case 'Unhealthy for Sensitive Groups':
      return { color: '#f97316', label: 'USG' };
    case 'Unhealthy':
      return { color: '#ef4444', label: 'Unhealthy' };
    case 'Very Unhealthy':
      return { color: '#a855f7', label: 'Very Unhealthy' };
    case 'Hazardous':
      return { color: '#7f1d1d', label: 'Hazardous' };
    default:
      return { color: '#6b7280', label: category };
  }
}

export function aqiToCategory(aqi: number): string {
  if (aqi >= 301) return 'Hazardous';
  if (aqi >= 201) return 'Very Unhealthy';
  if (aqi >= 151) return 'Unhealthy';
  if (aqi >= 101) return 'Unhealthy for Sensitive Groups';
  if (aqi >= 51) return 'Moderate';
  return 'Good';
}

// Grains/m³ thresholds, common allergy-reporting standards.
const POLLEN_THRESHOLDS: Record<PollenSpecies, { low: number; moderate: number; high: number; veryHigh: number }> = {
  grass: { low: 5, moderate: 20, high: 50, veryHigh: 200 },
  ragweed: { low: 5, moderate: 20, high: 50, veryHigh: 200 },
  birch: { low: 10, moderate: 50, high: 100, veryHigh: 500 },
  alder: { low: 10, moderate: 50, high: 100, veryHigh: 500 },
  olive: { low: 10, moderate: 50, high: 100, veryHigh: 500 },
  mugwort: { low: 5, moderate: 20, high: 50, veryHigh: 200 },
};

const SPECIES: PollenSpecies[] = ['alder', 'birch', 'grass', 'mugwort', 'olive', 'ragweed'];

export function classifyPollen(type: PollenSpecies, value: number): PollenLevel {
  const t = POLLEN_THRESHOLDS[type];
  if (!t || value < 1) return 'none';
  if (value < t.low) return 'low';
  if (value < t.moderate) return 'moderate';
  if (value < t.high) return 'high';
  return 'very-high';
}

export function pollenLevelOrder(level: PollenLevel): number {
  switch (level) {
    case 'none':
      return 0;
    case 'low':
      return 1;
    case 'moderate':
      return 2;
    case 'high':
      return 3;
    case 'very-high':
      return 4;
  }
}

// PM2.5 over 100 in the dominant slot is the wildfire-smoke signature.
export function isWildfireRisk(aq: AirQualityReading | null): boolean {
  if (!aq) return false;
  return aq.parameter === 'PM2.5' && aq.aqi > 100;
}

// Trend over the next 6 hours: rising/falling > 15 AQI counts as a real
// move; otherwise call it stable.
export function airQualityTrend(currentAqi: number, hourlyAqi: number[]): AQTrend {
  if (hourlyAqi.length === 0) return 'stable';
  const window = hourlyAqi.slice(0, 6);
  const peak = Math.max(...window);
  const min = Math.min(...window);
  if (peak - currentAqi >= 15) return 'worsening';
  if (currentAqi - min >= 15) return 'improving';
  return 'stable';
}

// === Source A: AirNow proxy =================================================

type AirNowProxyResponse = { ok: true; readings: AirNowReading[] } | { ok: false; reason: string };

async function fetchAirNow(lat: number, lon: number): Promise<AirNowReading[] | null> {
  try {
    const res = await fetch(`/api/airnow?lat=${lat}&lon=${lon}`);
    if (!res.ok) return null;
    const data = (await res.json()) as AirNowProxyResponse;
    if (!data.ok) return null;
    return data.readings;
  } catch {
    return null;
  }
}

export function dominantReading(readings: AirNowReading[]): AirNowReading | null {
  if (!readings.length) return null;
  return readings.reduce((worst, r) => (r.aqi > worst.aqi ? r : worst));
}

// === Source B: Open-Meteo Air Quality (hourly + pollen) =====================

type OMHourly = {
  time?: string[];
  pm10?: Array<number | null>;
  pm2_5?: Array<number | null>;
  ozone?: Array<number | null>;
  us_aqi?: Array<number | null>;
  us_aqi_pm2_5?: Array<number | null>;
  us_aqi_pm10?: Array<number | null>;
  us_aqi_ozone?: Array<number | null>;
  alder_pollen?: Array<number | null>;
  birch_pollen?: Array<number | null>;
  grass_pollen?: Array<number | null>;
  mugwort_pollen?: Array<number | null>;
  olive_pollen?: Array<number | null>;
  ragweed_pollen?: Array<number | null>;
};

type OMResponse = {
  hourly?: OMHourly;
};

type OpenMeteoData = {
  hourly: AQHourly[];
  pollen: PollenForecast | null;
};

async function fetchOpenMeteoAQ(lat: number, lon: number): Promise<OpenMeteoData | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly:
      'pm10,pm2_5,ozone,us_aqi,us_aqi_pm2_5,us_aqi_pm10,us_aqi_ozone,' +
      'alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen',
    timezone: 'auto',
    forecast_days: '3',
  });
  try {
    const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as OMResponse;
    const h = data.hourly;
    if (!h?.time || h.time.length === 0) return null;

    // Find the index aligned to the current local hour. Open-Meteo returns
    // its hourly array starting at the top of the day; we want "now".
    const nowMs = Date.now();
    const currentHourMs = nowMs - (nowMs % 3600000);
    let start = 0;
    for (let i = 0; i < h.time.length; i++) {
      if (new Date(h.time[i]).getTime() >= currentHourMs) {
        start = Math.max(0, i);
        break;
      }
    }

    const num = (v: number | null | undefined) => (typeof v === 'number' ? v : 0);

    // Hourly trajectory: next 24 hours (or as many as we have).
    const last = Math.min(h.time.length, start + 24);
    const hourly: AQHourly[] = [];
    for (let i = start; i < last; i++) {
      hourly.push({
        time: h.time[i],
        aqi: num(h.us_aqi?.[i]),
        pm25: num(h.pm2_5?.[i]),
        ozone: num(h.ozone?.[i]),
      });
    }

    // Pollen: current = first hour; peak24h = max per species across the
    // 24-hour window. Compute the dominant species' peak time too so the
    // recommendation copy can reference it.
    let pollen: PollenForecast | null = null;
    const speciesArrays: Record<PollenSpecies, Array<number | null> | undefined> = {
      alder: h.alder_pollen,
      birch: h.birch_pollen,
      grass: h.grass_pollen,
      mugwort: h.mugwort_pollen,
      olive: h.olive_pollen,
      ragweed: h.ragweed_pollen,
    };
    const hasAnyPollen = SPECIES.some((s) => {
      const arr = speciesArrays[s];
      return arr && arr.some((v) => typeof v === 'number' && v > 0);
    });
    if (hasAnyPollen) {
      const current: PollenReading[] = [];
      const peak24h: PollenReading[] = [];
      let dominantSpecies: PollenSpecies | null = null;
      let dominantPeak = -Infinity;
      let dominantPeakIdx = start;
      for (const s of SPECIES) {
        const arr = speciesArrays[s];
        if (!arr) continue;
        const cur = num(arr[start]);
        current.push({ type: s, value: cur, level: classifyPollen(s, cur) });
        let peak = 0;
        let peakIdx = start;
        for (let i = start; i < last; i++) {
          const v = num(arr[i]);
          if (v > peak) {
            peak = v;
            peakIdx = i;
          }
        }
        peak24h.push({ type: s, value: peak, level: classifyPollen(s, peak) });
        if (peak > dominantPeak) {
          dominantPeak = peak;
          dominantSpecies = s;
          dominantPeakIdx = peakIdx;
        }
      }
      pollen = {
        current,
        peak24h,
        peakTime: dominantSpecies ? h.time[dominantPeakIdx] ?? null : null,
      };
    }

    return { hourly, pollen };
  } catch {
    return null;
  }
}

// === Top-level fetch ========================================================

export async function fetchAirQuality(lat: number, lon: number): Promise<AirQualityReading | null> {
  const [airnow, om] = await Promise.all([fetchAirNow(lat, lon), fetchOpenMeteoAQ(lat, lon)]);

  // No data from either source.
  if ((!airnow || airnow.length === 0) && !om) return null;

  const hourly = om?.hourly ?? [];
  const pollen = om?.pollen ?? null;

  // Pick current AQI: prefer AirNow (real station), else Open-Meteo's
  // first hourly value.
  let source: 'airnow' | 'open-meteo' = 'open-meteo';
  let modeled = true;
  let aqi = 0;
  let category = 'Good';
  let parameter: string | null = null;
  let reportingArea: string | null = null;
  if (airnow && airnow.length > 0) {
    const dom = dominantReading(airnow)!;
    source = 'airnow';
    modeled = false;
    aqi = dom.aqi;
    category = dom.category;
    parameter = dom.parameter;
    reportingArea = dom.reportingArea;
  } else if (hourly.length > 0) {
    aqi = Math.round(hourly[0].aqi);
    category = aqiToCategory(aqi);
  }

  // Trend over the next 6 hours.
  const hourlyAqi = hourly.map((h) => h.aqi);
  const trend = airQualityTrend(aqi, hourlyAqi);
  let trendPeak: { aqi: number; time: string } | null = null;
  let trendMin: { aqi: number; time: string } | null = null;
  if (hourly.length > 0) {
    const window = hourly.slice(0, 6);
    const peakIdx = window.reduce((best, h, i, a) => (a[i].aqi > a[best].aqi ? i : best), 0);
    const minIdx = window.reduce((best, h, i, a) => (a[i].aqi < a[best].aqi ? i : best), 0);
    trendPeak = { aqi: Math.round(window[peakIdx].aqi), time: window[peakIdx].time };
    trendMin = { aqi: Math.round(window[minIdx].aqi), time: window[minIdx].time };
  }

  return {
    source,
    modeled,
    aqi,
    category,
    parameter,
    reportingArea,
    hourly,
    trend,
    trendPeak,
    trendMin,
    pollen,
    readings: airnow ?? undefined,
  };
}
