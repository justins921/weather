'use client';

import { openMeteoGate } from './api';

// Open-Meteo Ensemble API. ICON ensemble has ~40 perturbed members; the
// spread between members at any given hour is a real measure of forecast
// uncertainty. We collapse members into median + p10/p90 per hour for
// the variables the chart actually needs (temp + feels-like), and surface
// an avg-spread label for the Coming Up summary sentence.

export type EnsemblePoint = {
  time: string;
  median: number;
  p10: number;
  p90: number;
  spread: number; // p90 - p10
};

export type EnsembleData = {
  temperature_2m: EnsemblePoint[];
  apparent_temperature: EnsemblePoint[];
};

export type ConfidenceLabel = {
  level: 'high' | 'moderate' | 'low';
  message: string;
};

type EnsembleResponse = {
  hourly?: Record<string, unknown>;
};

const EMPTY: EnsembleData = { temperature_2m: [], apparent_temperature: [] };

export async function fetchEnsemble(lat: number, lon: number): Promise<EnsembleData> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    // We need apparent_temperature for the Feels Like band and
    // temperature_2m for the Temp band + confidence label. Wind / precip
    // are intentionally absent — those views don't render a band.
    hourly: 'temperature_2m,apparent_temperature',
    models: 'icon_seamless',
    temperature_unit: 'fahrenheit',
    timezone: 'auto',
    forecast_days: '2',
  });
  try {
    const res = await openMeteoGate(() =>
      fetch(`https://ensemble-api.open-meteo.com/v1/ensemble?${params}`, {
        next: { revalidate: 1800 },
      }),
    );
    if (!res.ok) return EMPTY;
    const data = (await res.json()) as EnsembleResponse;
    if (!data.hourly) return EMPTY;
    return {
      temperature_2m: buildEnsembleSeries(data.hourly, 'temperature_2m'),
      apparent_temperature: buildEnsembleSeries(data.hourly, 'apparent_temperature'),
    };
  } catch {
    return EMPTY;
  }
}

export function buildEnsembleSeries(
  rawHourly: Record<string, unknown>,
  prefix: 'temperature_2m' | 'apparent_temperature',
): EnsemblePoint[] {
  const times = (rawHourly.time as string[]) ?? [];
  const memberKeys = Object.keys(rawHourly).filter(
    (k) => k.startsWith(`${prefix}_member`) || k === prefix,
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
