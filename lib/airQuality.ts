'use client';

// Air quality. Two-tier source:
//   1. EPA AirNow (real monitoring stations, 25-mi search). Server-proxied
//      via /api/airnow so the key stays out of the client bundle.
//   2. Open-Meteo CAMS (modelled). Used when AirNow has no nearby station
//      OR when no AIRNOW_API_KEY is set. The UI flags this as "modeled" so
//      the data quality label is honest.

export type AirNowReading = {
  parameter: string; // e.g. "PM2.5", "O3"
  aqi: number;
  category: string; // "Good", "Moderate", "Unhealthy for Sensitive Groups", ...
  reportingArea: string;
};

export type AirQualityReading = {
  source: 'airnow' | 'open-meteo';
  modeled: boolean;
  aqi: number;
  category: string;
  parameter: string | null; // dominant pollutant (AirNow only)
  reportingArea: string | null; // station/area name (AirNow only)
  // Pollen (Open-Meteo only). Per-species grain counts; null in US.
  grassPollen?: number;
  treePollen?: number;
  weedPollen?: number;
  // Raw AirNow array (so the UI can show all measured pollutants if it wants).
  readings?: AirNowReading[];
};

// AirNow defines "the" AQI for an area as the worst (highest AQI) reading
// across all measured pollutants — the dominant pollutant.
export function dominantReading(readings: AirNowReading[]): AirNowReading | null {
  if (!readings.length) return null;
  return readings.reduce((worst, r) => (r.aqi > worst.aqi ? r : worst));
}

export type CategoryStyle = { color: string; label: string };

// Friendly label + colour for the AQ category. EPA's six standard categories.
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

// AirNow returns a category string per pollutant. When we have only a number
// (Open-Meteo modelled fallback), translate using EPA's standard breakpoints.
export function aqiToCategory(aqi: number): string {
  if (aqi >= 301) return 'Hazardous';
  if (aqi >= 201) return 'Very Unhealthy';
  if (aqi >= 151) return 'Unhealthy';
  if (aqi >= 101) return 'Unhealthy for Sensitive Groups';
  if (aqi >= 51) return 'Moderate';
  return 'Good';
}

type AirNowProxyResponse =
  | { ok: true; readings: AirNowReading[] }
  | { ok: false; reason: string };

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

type OMResponse = {
  current?: {
    us_aqi?: number | null;
    pm10?: number | null;
    pm2_5?: number | null;
    grass_pollen?: number | null;
    alder_pollen?: number | null;
    birch_pollen?: number | null;
    olive_pollen?: number | null;
    mugwort_pollen?: number | null;
    ragweed_pollen?: number | null;
  };
};

async function fetchOpenMeteoAQ(lat: number, lon: number): Promise<{
  aqi: number;
  grassPollen: number;
  treePollen: number;
  weedPollen: number;
} | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      'us_aqi,pm10,pm2_5,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen',
  });
  try {
    const res = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`);
    if (!res.ok) return null;
    const data = (await res.json()) as OMResponse;
    const c = data.current ?? {};
    const num = (v: number | null | undefined) => (typeof v === 'number' ? v : 0);
    return {
      aqi: num(c.us_aqi),
      grassPollen: num(c.grass_pollen),
      treePollen: Math.max(num(c.alder_pollen), num(c.birch_pollen), num(c.olive_pollen)),
      weedPollen: Math.max(num(c.mugwort_pollen), num(c.ragweed_pollen)),
    };
  } catch {
    return null;
  }
}

export async function fetchAirQuality(lat: number, lon: number): Promise<AirQualityReading | null> {
  // 1. AirNow first (real EPA station, when key + station available).
  const readings = await fetchAirNow(lat, lon);
  if (readings && readings.length > 0) {
    const dom = dominantReading(readings)!;
    return {
      source: 'airnow',
      modeled: false,
      aqi: dom.aqi,
      category: dom.category,
      parameter: dom.parameter,
      reportingArea: dom.reportingArea,
      readings,
    };
  }
  // 2. Open-Meteo modelled fallback (always works, lower data quality).
  const om = await fetchOpenMeteoAQ(lat, lon);
  if (!om) return null;
  return {
    source: 'open-meteo',
    modeled: true,
    aqi: Math.round(om.aqi),
    category: aqiToCategory(om.aqi),
    parameter: null,
    reportingArea: null,
    grassPollen: om.grassPollen,
    treePollen: om.treePollen,
    weedPollen: om.weedPollen,
  };
}

// Returns a hint suitable for the GolfCard one-line display. Returns null
// when conditions are fine — caller should omit the row entirely.
export type AirQualityHint = {
  label: string;
  hint: string;
  color: string;
};

export function airQualityHint(aq: AirQualityReading | null): AirQualityHint | null {
  if (!aq) return null;
  if (aq.aqi >= 100) {
    const style = categoryStyle(aq.category);
    return {
      label: style.label,
      hint: `AQI ${aq.aqi}${aq.parameter ? ` · ${aq.parameter}` : ''}`,
      color: style.color,
    };
  }
  // Pollen check (Open-Meteo only). Open-Meteo "High" thresholds:
  //   grass: ~20, tree: ~90, weed: ~50 grains/m³.
  if (aq.grassPollen !== undefined) {
    const ratios: Array<[number, string]> = [
      [(aq.grassPollen ?? 0) / 20, 'grass'],
      [(aq.treePollen ?? 0) / 90, 'tree'],
      [(aq.weedPollen ?? 0) / 50, 'weed'],
    ];
    ratios.sort((a, b) => b[0] - a[0]);
    if (ratios[0][0] >= 1) {
      return {
        label: `High ${ratios[0][1]} pollen`,
        hint: 'Bring tissues and allergy meds',
        color: '#84cc16',
      };
    }
  }
  return null;
}

// PM2.5 over 100 in the dominant slot is the wildfire-smoke signature.
export function isWildfireRisk(aq: AirQualityReading | null): boolean {
  if (!aq) return false;
  return aq.parameter === 'PM2.5' && aq.aqi > 100;
}
