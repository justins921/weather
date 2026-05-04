'use client';

// Open-Meteo Ensemble API. ICON ensemble has ~40 perturbed members; the
// spread between them at any given hour is a real measure of forecast
// uncertainty. We collapse the members into median + p10/p90 so the
// chart can draw a confidence band, and surface an avg-spread label
// for the Coming Up summary sentence.

export type EnsemblePoint = {
  time: string;
  median: number;
  p10: number;
  p90: number;
  spread: number; // p90 - p10
};

export type ConfidenceLabel = {
  level: 'high' | 'moderate' | 'low';
  // Empty string when spread is tight enough that no extra note is needed.
  message: string;
};

type EnsembleResponse = {
  hourly?: Record<string, unknown>;
};

export async function fetchEnsemble(lat: number, lon: number): Promise<EnsemblePoint[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'temperature_2m,precipitation_probability,wind_speed_10m',
    models: 'icon_seamless',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timezone: 'auto',
    forecast_days: '2',
  });
  try {
    const res = await fetch(
      `https://ensemble-api.open-meteo.com/v1/ensemble?${params}`,
      { next: { revalidate: 1800 } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as EnsembleResponse;
    if (!data.hourly) return [];
    return buildEnsembleSeries(data.hourly);
  } catch {
    return [];
  }
}

export function buildEnsembleSeries(rawHourly: Record<string, unknown>): EnsemblePoint[] {
  const times = (rawHourly.time as string[]) ?? [];
  const memberKeys = Object.keys(rawHourly).filter(
    (k) => k.startsWith('temperature_2m_member') || k === 'temperature_2m',
  );
  if (times.length === 0 || memberKeys.length === 0) return [];

  return times.map((time, hourIdx) => {
    const values = memberKeys
      .map((k) => {
        const arr = rawHourly[k] as Array<number | null>;
        return arr?.[hourIdx];
      })
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      .sort((a, b) => a - b);

    if (values.length === 0) {
      return { time, median: 0, p10: 0, p90: 0, spread: 0 };
    }
    const median = percentile(values, 0.5);
    const p10 = percentile(values, 0.1);
    const p90 = percentile(values, 0.9);
    return { time, median, p10, p90, spread: p90 - p10 };
  });
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const idx = (sortedValues.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedValues[lo];
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (idx - lo);
}

export function confidenceLabel(series: EnsemblePoint[]): ConfidenceLabel {
  const next24 = series.slice(0, 24);
  if (next24.length === 0) return { level: 'high', message: '' };
  const avgSpread = next24.reduce((s, p) => s + p.spread, 0) / next24.length;
  if (avgSpread < 4) return { level: 'high', message: '' };
  if (avgSpread < 8) {
    return { level: 'moderate', message: 'Models show some variability.' };
  }
  return {
    level: 'low',
    message: 'Forecast confidence is low — wide spread between models.',
  };
}
