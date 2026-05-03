'use client';

// NWS direct integrations beyond /alerts/active.
//
//   1. Identify the local forecast office for a coordinate
//      (api.weather.gov/points/{lat},{lon}).
//   2. List Area Forecast Discussion products for that office
//      (api.weather.gov/products/types/AFD/locations/{gridId}).
//   3. Fetch the most recent product's plain-text body
//      (api.weather.gov/products/{id}).
//
// NWS asks every consumer to identify itself in the User-Agent header.
// Bump the version string whenever the integration changes meaningfully.

export const NWS_USER_AGENT = 'Sobojinski-Weather/1.0 (https://github.com/justins921/weather)';

export const NWS_HEADERS: HeadersInit = {
  'User-Agent': NWS_USER_AGENT,
  Accept: 'application/geo+json',
};

export type ForecastOffice = {
  gridId: string; // e.g. "MKX"
  forecastOfficeUrl: string;
};

const officeCache = new Map<string, ForecastOffice | null>();

export async function findForecastOffice(lat: number, lon: number): Promise<ForecastOffice | null> {
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  if (officeCache.has(key)) return officeCache.get(key)!;
  try {
    const res = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
      headers: NWS_HEADERS,
    });
    if (!res.ok) {
      officeCache.set(key, null);
      return null;
    }
    const data = (await res.json()) as {
      properties?: { gridId?: string; forecastOffice?: string };
    };
    const gridId = data.properties?.gridId;
    const forecastOfficeUrl = data.properties?.forecastOffice;
    if (!gridId) {
      officeCache.set(key, null);
      return null;
    }
    const result = { gridId, forecastOfficeUrl: forecastOfficeUrl ?? '' };
    officeCache.set(key, result);
    return result;
  } catch {
    officeCache.set(key, null);
    return null;
  }
}

export type AFD = {
  productId: string;
  issuanceTime: string;
  office: string; // gridId, e.g. "MKX"
  text: string; // raw plain text, all-caps with .SECTION markers
};

// Two-step lookup: list products for the office, take the most recent, fetch its text.
export async function fetchLatestAFD(lat: number, lon: number): Promise<AFD | null> {
  const office = await findForecastOffice(lat, lon);
  if (!office) return null;
  try {
    const listRes = await fetch(
      `https://api.weather.gov/products/types/AFD/locations/${office.gridId}`,
      { headers: NWS_HEADERS },
    );
    if (!listRes.ok) return null;
    const listData = (await listRes.json()) as {
      '@graph'?: Array<{ '@id'?: string; id?: string; issuanceTime?: string }>;
    };
    const products = listData['@graph'] ?? [];
    if (products.length === 0) return null;
    // Already sorted newest-first by NWS, but be defensive.
    const newest = [...products].sort(
      (a, b) =>
        new Date(b.issuanceTime ?? 0).getTime() - new Date(a.issuanceTime ?? 0).getTime(),
    )[0];
    const productUrl = newest['@id'] ?? `https://api.weather.gov/products/${newest.id}`;
    if (!productUrl) return null;
    const prodRes = await fetch(productUrl, { headers: NWS_HEADERS });
    if (!prodRes.ok) return null;
    const prodData = (await prodRes.json()) as {
      productText?: string;
      issuanceTime?: string;
      id?: string;
    };
    if (!prodData.productText) return null;
    return {
      productId: prodData.id ?? newest.id ?? '',
      issuanceTime: prodData.issuanceTime ?? newest.issuanceTime ?? '',
      office: office.gridId,
      text: prodData.productText,
    };
  } catch {
    return null;
  }
}

// AFDs are all-caps text products with section markers like:
//   .SHORT TERM /THIS AFTERNOON THROUGH TUESDAY/...
//   .LONG TERM...
//   .AVIATION...
//   .HYDROLOGY...
// We slice into sections and only surface SHORT TERM / LONG TERM / SYNOPSIS /
// KEY MESSAGES — the others are operational noise for non-pilots.

export type AFDSection = {
  heading: string; // already title-cased
  body: string; // sentence-cased body
};

const KEEP_SECTIONS = new Set([
  'SYNOPSIS',
  'KEY MESSAGES',
  'SHORT TERM',
  'LONG TERM',
  'DISCUSSION',
]);

const PRESERVE_TOKENS = new Set([
  'NWS',
  'AFD',
  'NW',
  'NE',
  'SE',
  'SW',
  'WSW',
  'WNW',
  'ENE',
  'ESE',
  'SSW',
  'SSE',
  'NNW',
  'NNE',
  'NORTH',
  'SOUTH',
  'EAST',
  'WEST',
  'MPH',
  'KT',
  'KTS',
  'AM',
  'PM',
  'CDT',
  'CST',
  'EDT',
  'EST',
  'MDT',
  'MST',
  'PDT',
  'PST',
  'AKDT',
  'AKST',
  'HST',
  'UTC',
  'GMT',
  'PWAT',
  'CAPE',
  'PV',
  'TS',
  'SHRA',
  'SHSN',
  'BR',
  'FG',
  'GFS',
  'NAM',
  'HRRR',
  'RAP',
  'ECMWF',
  'WPC',
  'SPC',
  'NHC',
]);

function sentenceCase(line: string): string {
  return line
    .split(/(\s+)/)
    .map((tok) => {
      if (!tok.trim()) return tok;
      if (/^\d/.test(tok)) return tok; // numbers untouched
      const stripped = tok.replace(/[^A-Z]/g, '');
      if (stripped.length === 0) return tok.toLowerCase();
      if (PRESERVE_TOKENS.has(stripped)) return tok;
      // Title-case the first letter, lowercase the rest.
      return tok[0].toUpperCase() + tok.slice(1).toLowerCase();
    })
    .join('');
}

export function parseAFD(text: string): AFDSection[] {
  // Split on section markers like ".SHORT TERM..." (line begins with .)
  const lines = text.split('\n');
  const sections: AFDSection[] = [];
  let currentHeading: string | null = null;
  let currentBody: string[] = [];

  const flush = () => {
    if (currentHeading) {
      const body = currentBody.join('\n').trim();
      if (body) sections.push({ heading: titleCase(currentHeading), body: sentenceCase(body) });
    }
    currentBody = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    // Section markers: line starts with . and is mostly uppercase letters.
    const m = /^\.([A-Z][A-Z0-9 \/&.-]+?)(?:\.\.\.|\b)/.exec(line);
    if (m) {
      flush();
      const head = m[1].split('/')[0].trim(); // strip the slash subtitle
      currentHeading = head;
      // Anything after the marker on the same line is part of the body.
      const rest = line.slice(m[0].length).trim();
      if (rest) currentBody.push(rest);
      continue;
    }
    if (currentHeading) currentBody.push(raw);
  }
  flush();

  return sections.filter((s) => {
    const upper = s.heading.toUpperCase();
    if (KEEP_SECTIONS.has(upper)) return true;
    // Heuristic: keep if heading length is short and not in the operational deny-list.
    return false;
  });
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}
