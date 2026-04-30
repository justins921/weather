import { NextResponse } from 'next/server';

// Server proxy for Synoptic Data Mesonet API. Keeps the token server-side
// so it never ships in the client bundle. Free-tier token at:
//   https://customer.synopticdata.com/credentials/
// Add to .env.local as SYNOPTIC_TOKEN=<your-token>.
//
// We ask for the closest stations to a coordinate and return a shape that
// the client can collapse into its existing Observation type.

export const dynamic = 'force-dynamic';

const VARS = [
  'air_temp',
  'dew_point_temperature',
  'relative_humidity',
  'wind_speed',
  'wind_gust',
  'wind_direction',
  'precip_accum_one_hour',
  'weather_condition',
].join(',');

type SynopticObservationValue = {
  date_time?: string;
  value?: number | string | null;
};

type SynopticStation = {
  STID?: string;
  NAME?: string;
  DISTANCE?: number; // miles
  LATITUDE?: string;
  LONGITUDE?: string;
  MNET_SHORTNAME?: string;
  OBSERVATIONS?: Record<string, SynopticObservationValue | null>;
};

type SynopticResponse = {
  STATION?: SynopticStation[];
  SUMMARY?: { RESPONSE_CODE?: number; RESPONSE_MESSAGE?: string };
};

export async function GET(request: Request) {
  const token = process.env.SYNOPTIC_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, reason: 'no-token' }, { status: 200 });
  }
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get('lat') ?? '');
  const lon = parseFloat(url.searchParams.get('lon') ?? '');
  const radius = url.searchParams.get('radius') ?? '5'; // miles
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ ok: false, reason: 'bad-coords' }, { status: 400 });
  }

  const params = new URLSearchParams({
    token,
    radius: `${lat},${lon},${radius}`,
    vars: VARS,
    units: 'english',
    limit: '5',
    obrange: minutesAgo(120), // skip stations that haven't reported in 2h
  });

  try {
    const res = await fetch(`https://api.synopticdata.com/v2/stations/latest?${params}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, reason: 'upstream', status: res.status },
        { status: 200 },
      );
    }
    const data = (await res.json()) as SynopticResponse;
    if (data.SUMMARY?.RESPONSE_CODE !== 1) {
      return NextResponse.json(
        { ok: false, reason: 'upstream', message: data.SUMMARY?.RESPONSE_MESSAGE },
        { status: 200 },
      );
    }
    const stations = (data.STATION ?? []).map((s) => normaliseStation(s));
    return NextResponse.json({ ok: true, stations }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, reason: 'fetch-error', error: e instanceof Error ? e.message : 'unknown' },
      { status: 200 },
    );
  }
}

function minutesAgo(mins: number): string {
  // Synoptic obrange format: YYYYMMDDHHMM,YYYYMMDDHHMM (or just one bound).
  const d = new Date(Date.now() - mins * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
}

function readVal(obs: SynopticStation['OBSERVATIONS'], key: string): number | null {
  if (!obs) return null;
  const v = obs[key];
  if (!v) return null;
  const value = v.value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function readTime(obs: SynopticStation['OBSERVATIONS'], key: string): string | null {
  if (!obs) return null;
  const v = obs[key];
  return v?.date_time ?? null;
}

function readText(obs: SynopticStation['OBSERVATIONS'], key: string): string | null {
  if (!obs) return null;
  const v = obs[key];
  if (!v) return null;
  if (typeof v.value === 'string') return v.value;
  return null;
}

function normaliseStation(s: SynopticStation) {
  // Pick the most recent timestamp across the variables we care about.
  const obs = s.OBSERVATIONS ?? {};
  const ts =
    readTime(obs, 'air_temp_value_1') ??
    readTime(obs, 'wind_speed_value_1') ??
    readTime(obs, 'relative_humidity_value_1');
  return {
    stationId: s.STID ?? '',
    name: s.NAME ?? '',
    network: s.MNET_SHORTNAME ?? null,
    distanceMi: typeof s.DISTANCE === 'number' ? s.DISTANCE : null,
    observedAt: ts,
    temperature_f: readVal(obs, 'air_temp_value_1'),
    dewpoint_f: readVal(obs, 'dew_point_temperature_value_1'),
    humidity: readVal(obs, 'relative_humidity_value_1'),
    wind_speed_mph: readVal(obs, 'wind_speed_value_1'),
    wind_gusts_mph: readVal(obs, 'wind_gust_value_1'),
    wind_direction: readVal(obs, 'wind_direction_value_1'),
    precip_last_hour_in: readVal(obs, 'precip_accum_one_hour_value_1'),
    weatherCondition: readText(obs, 'weather_condition_value_1'),
  };
}
