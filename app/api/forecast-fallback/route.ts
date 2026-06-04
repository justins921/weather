import { NextResponse } from 'next/server';
import type { Forecast } from '@/lib/types';

// Free global forecast fallback via MET Norway when Open-Meteo is down.
// Requires User-Agent (forbidden in browser), so it runs server-side.
// Coverage: worldwide. License: CC BY 4.0. No API key needed.

export const dynamic = 'force-dynamic';

const USER_AGENT = process.env.METNO_CONTACT
  ? `Sobojinski-Weather/1.0 ${process.env.METNO_CONTACT}`
  : 'Sobojinski-Weather/1.0 (https://github.com/justins921/weather)';

type METDetails = Record<string, number | undefined>;
type METTimeseries = {
  time: string;
  data: {
    instant: { details: METDetails };
    next_1_hours?: { summary?: { symbol_code?: string }; details?: METDetails };
    next_6_hours?: { summary?: { symbol_code?: string }; details?: METDetails };
  };
};
type METResponse = { properties: { timeseries: METTimeseries[] } };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get('lat') ?? '');
  const lon = parseFloat(url.searchParams.get('lon') ?? '');
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ ok: false, reason: 'bad-coords' }, { status: 400 });
  }
  try {
    const res = await fetch(
      `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`,
      { headers: { 'User-Agent': USER_AGENT }, next: { revalidate: 1800 } },
    );
    if (!res.ok) {
      return NextResponse.json({ ok: false, reason: `met-${res.status}` }, { status: 502 });
    }
    const data = (await res.json()) as METResponse;
    return NextResponse.json({ ok: true, forecast: adapt(lat, lon, data) });
  } catch {
    return NextResponse.json({ ok: false, reason: 'met-fetch-failed' }, { status: 502 });
  }
}

// ---------------------------------------------------------------- adapter ---

function adapt(lat: number, lon: number, met: METResponse): Forecast {
  // Approximate timezone offset from longitude — within ±1 hour globally,
  // accurate enough for displaying location-local times. MET Norway returns
  // UTC timestamps; we re-emit them as offset-less ISO strings so the rest
  // of the app's parseLocationLocal helpers work unchanged.
  const tzOffsetHours = Math.round(lon / 15);
  const tzOffsetMs = tzOffsetHours * 3600000;

  const series = met.properties.timeseries.slice(0, 192);
  const hourly = {
    time: [] as string[],
    temperature_2m: [] as number[],
    apparent_temperature: [] as number[],
    relative_humidity_2m: [] as number[],
    dew_point_2m: [] as number[],
    precipitation_probability: [] as number[],
    precipitation: [] as number[],
    weather_code: [] as number[],
    wind_speed_10m: [] as number[],
    wind_direction_10m: [] as number[],
    wind_gusts_10m: [] as number[],
    cloud_cover: [] as number[],
    uv_index: [] as number[],
    surface_pressure: [] as number[],
    visibility: [] as number[],
    is_day: [] as number[],
  };

  for (const ts of series) {
    const utcMs = new Date(ts.time).getTime();
    const inst = ts.data.instant.details;
    const next = ts.data.next_1_hours ?? ts.data.next_6_hours;
    const det = next?.details ?? {};
    const sym = next?.summary?.symbol_code ?? '';

    const tempF = cToF(inst.air_temperature ?? 0);
    const dewF = cToF(inst.dew_point_temperature ?? (inst.air_temperature ?? 0) - 5);
    const humidity = inst.relative_humidity ?? 50;
    const windMph = msToMph(inst.wind_speed ?? 0);
    const gustMph = msToMph(inst.wind_speed_of_gust ?? inst.wind_speed ?? 0);
    const cloud = inst.cloud_area_fraction ?? 0;
    const pressure = inst.air_pressure_at_sea_level ?? 1013;
    const uv = inst.ultraviolet_index_clear_sky ?? 0;
    const precipMm = det.precipitation_amount ?? 0;
    const precipProb = det.probability_of_precipitation ?? (precipMm > 0 ? 60 : 0);

    hourly.time.push(formatLocalISO(utcMs + tzOffsetMs));
    hourly.temperature_2m.push(r1(tempF));
    hourly.apparent_temperature.push(r1(feelsLike(tempF, humidity, windMph)));
    hourly.relative_humidity_2m.push(r1(humidity));
    hourly.dew_point_2m.push(r1(dewF));
    hourly.precipitation_probability.push(r1(precipProb));
    hourly.precipitation.push(r2(mmToIn(precipMm)));
    hourly.weather_code.push(symbolToWmo(sym));
    hourly.wind_speed_10m.push(r1(windMph));
    hourly.wind_direction_10m.push(r1(inst.wind_from_direction ?? 0));
    hourly.wind_gusts_10m.push(r1(gustMph));
    hourly.cloud_cover.push(r1(cloud));
    hourly.uv_index.push(r1(uv));
    hourly.surface_pressure.push(r1(pressure));
    hourly.visibility.push(16093); // ~10 mi default; MET doesn't provide
    hourly.is_day.push(isDayAt(lat, lon, utcMs) ? 1 : 0);
  }

  const first = series[0];
  const fInst = first.data.instant.details;
  const fNext = first.data.next_1_hours ?? first.data.next_6_hours;
  const fSym = fNext?.summary?.symbol_code ?? '';
  const fPrecipMm = fNext?.details?.precipitation_amount ?? 0;
  const fTempF = cToF(fInst.air_temperature ?? 0);
  const fDewF = cToF(fInst.dew_point_temperature ?? (fInst.air_temperature ?? 0) - 5);
  const fHumidity = fInst.relative_humidity ?? 50;
  const fWindMph = msToMph(fInst.wind_speed ?? 0);
  const fGustMph = msToMph(fInst.wind_speed_of_gust ?? fInst.wind_speed ?? 0);
  const fUtcMs = new Date(first.time).getTime();

  const current = {
    time: formatLocalISO(fUtcMs + tzOffsetMs),
    temperature_2m: r1(fTempF),
    relative_humidity_2m: r1(fHumidity),
    apparent_temperature: r1(feelsLike(fTempF, fHumidity, fWindMph)),
    precipitation: r2(mmToIn(fPrecipMm)),
    weather_code: symbolToWmo(fSym),
    wind_speed_10m: r1(fWindMph),
    wind_direction_10m: r1(fInst.wind_from_direction ?? 0),
    wind_gusts_10m: r1(fGustMph),
    dew_point_2m: r1(fDewF),
    cloud_cover: r1(fInst.cloud_area_fraction ?? 0),
    is_day: isDayAt(lat, lon, fUtcMs) ? 1 : 0,
  };

  const daily = aggregateDaily(hourly, lat, lon, tzOffsetMs);

  return {
    latitude: lat,
    longitude: lon,
    timezone: `GMT${tzOffsetHours >= 0 ? '+' : ''}${tzOffsetHours}`,
    elevation: 0,
    current,
    hourly,
    daily,
  };
}

function aggregateDaily(
  hourly: { time: string[]; [k: string]: number[] | string[] },
  lat: number,
  lon: number,
  tzOffsetMs: number,
) {
  const byDay = new Map<string, number[]>();
  for (let i = 0; i < hourly.time.length; i++) {
    const day = hourly.time[i].slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(i);
  }
  const days = Array.from(byDay.keys()).sort();
  const daily = {
    time: [] as string[],
    weather_code: [] as number[],
    temperature_2m_max: [] as number[],
    temperature_2m_min: [] as number[],
    apparent_temperature_max: [] as number[],
    apparent_temperature_min: [] as number[],
    precipitation_probability_max: [] as number[],
    precipitation_sum: [] as number[],
    wind_speed_10m_max: [] as number[],
    wind_gusts_10m_max: [] as number[],
    wind_direction_10m_dominant: [] as number[],
    sunrise: [] as string[],
    sunset: [] as string[],
    uv_index_max: [] as number[],
  };
  const at = (k: string, i: number) => (hourly[k] as number[])[i];
  for (const day of days) {
    const idx = byDay.get(day)!;
    const max = (k: string) => Math.max(...idx.map((i) => at(k, i)));
    const min = (k: string) => Math.min(...idx.map((i) => at(k, i)));
    const sum = (k: string) => idx.reduce((s, i) => s + at(k, i), 0);
    daily.time.push(day);
    daily.weather_code.push(modeCode(idx.map((i) => at('weather_code', i))));
    daily.temperature_2m_max.push(r1(max('temperature_2m')));
    daily.temperature_2m_min.push(r1(min('temperature_2m')));
    daily.apparent_temperature_max.push(r1(max('apparent_temperature')));
    daily.apparent_temperature_min.push(r1(min('apparent_temperature')));
    daily.precipitation_probability_max.push(r1(max('precipitation_probability')));
    daily.precipitation_sum.push(r2(sum('precipitation')));
    daily.wind_speed_10m_max.push(r1(max('wind_speed_10m')));
    daily.wind_gusts_10m_max.push(r1(max('wind_gusts_10m')));
    daily.wind_direction_10m_dominant.push(
      r1(circularMean(idx.map((i) => at('wind_direction_10m', i)))),
    );
    daily.uv_index_max.push(r1(max('uv_index')));
    const dayDate = new Date(`${day}T12:00:00Z`);
    const { sunrise, sunset } = sunTimes(lat, lon, dayDate);
    daily.sunrise.push(sunrise ? formatLocalISO(sunrise.getTime() + tzOffsetMs) : `${day}T06:00`);
    daily.sunset.push(sunset ? formatLocalISO(sunset.getTime() + tzOffsetMs) : `${day}T20:00`);
  }
  return daily;
}

// ---------------------------------------------------------------- helpers ---

const cToF = (c: number) => c * 9 / 5 + 32;
const mmToIn = (mm: number) => mm / 25.4;
const msToMph = (ms: number) => ms * 2.236936;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

function formatLocalISO(ms: number): string {
  const d = new Date(ms);
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mn = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yy}-${mm}-${dd}T${hh}:${mn}`;
}

function feelsLike(tempF: number, humidity: number, windMph: number): number {
  if (tempF >= 80 && humidity >= 40) {
    const T = tempF;
    const R = humidity;
    return -42.379 + 2.04901523 * T + 10.14333127 * R - 0.22475541 * T * R
      - 6.83783e-3 * T * T - 5.481717e-2 * R * R
      + 1.22874e-3 * T * T * R + 8.5282e-4 * T * R * R - 1.99e-6 * T * T * R * R;
  }
  if (tempF <= 50 && windMph >= 3) {
    const v = Math.pow(windMph, 0.16);
    return 35.74 + 0.6215 * tempF - 35.75 * v + 0.4275 * tempF * v;
  }
  return tempF;
}

function symbolToWmo(sym: string): number {
  if (!sym) return 0;
  const base = sym.replace(/_(day|night|polartwilight)$/, '');
  if (base.includes('thunder')) return 95;
  if (base.startsWith('heavysnow')) return 75;
  if (base.startsWith('lightsnow')) return 71;
  if (base.startsWith('snow')) return 73;
  if (base.startsWith('heavysleet') || base.startsWith('sleet')) return 67;
  if (base.startsWith('lightsleet')) return 56;
  if (base.startsWith('heavyrain')) return 65;
  if (base.startsWith('lightrain')) return 51;
  if (base.startsWith('rain')) return 63;
  if (base === 'fog') return 45;
  if (base === 'partlycloudy') return 2;
  if (base === 'cloudy') return 3;
  if (base === 'fair') return 1;
  if (base === 'clearsky' || base === 'clear') return 0;
  return 3;
}

function modeCode(codes: number[]): number {
  // Worst (highest WMO code) wins ties — overcast > clear when both are common.
  const count = new Map<number, number>();
  let best = codes[0] ?? 0;
  let bestN = 0;
  for (const c of codes) {
    const n = (count.get(c) ?? 0) + 1;
    count.set(c, n);
    if (n > bestN || (n === bestN && c > best)) {
      bestN = n;
      best = c;
    }
  }
  return best;
}

function circularMean(degs: number[]): number {
  if (degs.length === 0) return 0;
  let sx = 0;
  let sy = 0;
  const rad = Math.PI / 180;
  for (const d of degs) {
    sx += Math.cos(d * rad);
    sy += Math.sin(d * rad);
  }
  const a = Math.atan2(sy, sx) / rad;
  return (a + 360) % 360;
}

// Sunrise/sunset via the simplified algorithm from
// https://en.wikipedia.org/wiki/Sunrise_equation. Accurate to ~1 minute,
// which is plenty for "can I finish 18 before dark".
function sunTimes(lat: number, lon: number, date: Date): { sunrise: Date | null; sunset: Date | null } {
  const rad = Math.PI / 180;
  const J1970 = 2440588;
  const J2000 = 2451545;
  const dayMs = 86400000;
  const toJulian = (d: Date) => d.getTime() / dayMs - 0.5 + J1970;
  const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * dayMs);
  const n = Math.round(toJulian(date) - J2000 - 0.0009 + lon / 360);
  const Js = J2000 + 0.0009 - lon / 360 + n;
  const M = (357.5291 + 0.98560028 * (Js - J2000)) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const Jtransit = Js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const sinDelta = Math.sin(L * rad) * Math.sin(23.44 * rad);
  const cosDelta = Math.sqrt(1 - sinDelta * sinDelta);
  const cosOmega =
    (Math.sin(-0.83 * rad) - Math.sin(lat * rad) * sinDelta) / (Math.cos(lat * rad) * cosDelta);
  if (cosOmega > 1 || cosOmega < -1) return { sunrise: null, sunset: null };
  const omega = Math.acos(cosOmega) / rad / 360;
  return { sunrise: fromJulian(Jtransit - omega), sunset: fromJulian(Jtransit + omega) };
}

function isDayAt(lat: number, lon: number, utcMs: number): boolean {
  const { sunrise, sunset } = sunTimes(lat, lon, new Date(utcMs));
  if (!sunrise || !sunset) {
    const month = new Date(utcMs).getUTCMonth();
    const summerNorth = month >= 3 && month <= 8;
    if (lat > 66.5) return summerNorth;
    if (lat < -66.5) return !summerNorth;
    return true;
  }
  return utcMs >= sunrise.getTime() && utcMs <= sunset.getTime();
}
