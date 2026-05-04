import { NextResponse } from 'next/server';

// Server proxy for Nominatim (OpenStreetMap geocoder). Two reasons it has
// to be server-side:
//   1. Nominatim's TOS requires a User-Agent with real contact info.
//      Browsers forbid setting User-Agent from fetch() — we can only set
//      it from a server. Without it Nominatim can ban the IP.
//   2. The 1 req/sec rate limit is enforced in-process here so the client
//      can't accidentally violate it.
//
// Set NOMINATIM_CONTACT in the env to override the contact email; if not
// set we fall back to the spec's value. Either way the User-Agent only
// goes upstream — never to the browser.

export const dynamic = 'force-dynamic';

const DEFAULT_CONTACT = 'justin@sobojinski.com';
function userAgent(): string {
  const contact = process.env.NOMINATIM_CONTACT || DEFAULT_CONTACT;
  return `Sobojinski-Weather/1.0 (${contact})`;
}

let lastFetchAt = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 3) {
    return NextResponse.json({ ok: false, reason: 'too-short' }, { status: 200 });
  }

  // Throttle to 1 req/sec/instance. Cold-start serverless functions reset
  // the counter; for a personal-use app that's fine.
  const now = Date.now();
  const elapsed = now - lastFetchAt;
  if (elapsed < 1100) {
    await new Promise((r) => setTimeout(r, 1100 - elapsed));
  }
  lastFetchAt = Date.now();

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '8',
    addressdetails: '1',
    extratags: '1',
  });

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'User-Agent': userAgent() },
    });
    if (res.status === 429 || res.status === 503) {
      return NextResponse.json({ ok: false, reason: 'rate-limited' }, { status: 200 });
    }
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, reason: 'upstream', status: res.status },
        { status: 200 },
      );
    }
    const raw = await res.json();
    return NextResponse.json({ ok: true, results: raw }, { status: 200 });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, reason: 'fetch-error', error: e instanceof Error ? e.message : 'unknown' },
      { status: 200 },
    );
  }
}
