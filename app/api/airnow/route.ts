import { NextResponse } from 'next/server';

// Server proxy for the EPA AirNow API. Keeps AIRNOW_API_KEY server-side.
// Free key at https://docs.airnowapi.org/account/request/. Returns the array
// of pollutant readings from the nearest monitoring station within 25 mi.

export const dynamic = 'force-dynamic';

type AirNowEntry = {
  DateObserved?: string;
  HourObserved?: number;
  LocalTimeZone?: string;
  ReportingArea?: string;
  StateCode?: string;
  ParameterName?: string;
  AQI?: number;
  Category?: { Number?: number; Name?: string };
};

export async function GET(request: Request) {
  const key = process.env.AIRNOW_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, reason: 'no-key' }, { status: 200 });
  }
  const url = new URL(request.url);
  const lat = parseFloat(url.searchParams.get('lat') ?? '');
  const lon = parseFloat(url.searchParams.get('lon') ?? '');
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return NextResponse.json({ ok: false, reason: 'bad-coords' }, { status: 400 });
  }

  const params = new URLSearchParams({
    format: 'application/json',
    latitude: String(lat),
    longitude: String(lon),
    distance: '25',
    API_KEY: key,
  });
  try {
    const res = await fetch(
      `https://www.airnowapi.org/aq/observation/latLong/current/?${params}`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, reason: 'upstream', status: res.status },
        { status: 200 },
      );
    }
    const raw = (await res.json()) as AirNowEntry[];
    const readings = (raw ?? [])
      .filter((e) => typeof e.AQI === 'number' && e.ParameterName && e.Category?.Name)
      .map((e) => ({
        parameter: e.ParameterName ?? '',
        aqi: e.AQI as number,
        category: e.Category?.Name ?? 'Unknown',
        reportingArea: e.ReportingArea ?? '',
      }));
    return NextResponse.json({ ok: true, readings }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        reason: 'fetch-error',
        error: e instanceof Error ? e.message : 'unknown',
      },
      { status: 200 },
    );
  }
}
