'use client';

// Open-Meteo Air Quality — free, no key.
// We only surface this when AQI >= 100 (Unhealthy for Sensitive Groups or
// worse) or when any pollen species is High by Open-Meteo's grains/m³
// thresholds, otherwise it's noise on a perfectly fine day.

export type AirQuality = {
  aqi: number;
  pm10: number;
  pm2_5: number;
  grassPollen: number;
  treePollen: number;
  weedPollen: number;
};

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

export async function fetchAirQuality(lat: number, lon: number): Promise<AirQuality | null> {
  // Open-Meteo's pollen is per-species (CAMS); we group them into the three
  // buckets a US user thinks in. Outside Europe, pollen returns null and we
  // simply rely on AQI.
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      'us_aqi,pm10,pm2_5,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen',
  });
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as OMResponse;
    const c = data.current ?? {};
    const num = (v: number | null | undefined) => (typeof v === 'number' ? v : 0);
    return {
      aqi: num(c.us_aqi),
      pm10: num(c.pm10),
      pm2_5: num(c.pm2_5),
      grassPollen: num(c.grass_pollen),
      treePollen: Math.max(num(c.alder_pollen), num(c.birch_pollen), num(c.olive_pollen)),
      weedPollen: Math.max(num(c.mugwort_pollen), num(c.ragweed_pollen)),
    };
  } catch {
    return null;
  }
}

export type AirQualityHint = {
  label: string;
  hint: string;
  color: string;
};

// Pollen thresholds (grains/m³) for "High" in Open-Meteo's reporting:
//   grass: ~20, tree: ~90, weed: ~50.
// Returns null when conditions are fine — let the UI omit the row.
export function airQualityHint(aq: AirQuality | null): AirQualityHint | null {
  if (!aq) return null;
  if (aq.aqi >= 200) {
    return { label: 'Very Unhealthy', hint: `AQI ${Math.round(aq.aqi)}`, color: '#7f1d1d' };
  }
  if (aq.aqi >= 150) {
    return { label: 'Unhealthy', hint: `AQI ${Math.round(aq.aqi)}`, color: '#dc2626' };
  }
  if (aq.aqi >= 100) {
    return {
      label: 'Sensitive groups',
      hint: `AQI ${Math.round(aq.aqi)} — sensitive groups should limit exertion`,
      color: '#f97316',
    };
  }
  // Pollen check — pick the dominant species at "High" or above.
  const ratios: Array<[number, string]> = [
    [aq.grassPollen / 20, 'grass'],
    [aq.treePollen / 90, 'tree'],
    [aq.weedPollen / 50, 'weed'],
  ];
  ratios.sort((a, b) => b[0] - a[0]);
  if (ratios[0][0] >= 1) {
    return {
      label: `High ${ratios[0][1]} pollen`,
      hint: 'Bring tissues and allergy meds',
      color: '#84cc16',
    };
  }
  return null;
}
