'use client';

// Client wrapper around the /api/golf-search server proxy. The wrapper
// handles caching, golf-specific filtering, and the "X golf course"
// fallback when the raw query doesn't return anything golf-tagged.

export type GolfCourseResult = {
  name: string;
  lat: number;
  lon: number;
  address: string;
  type: 'exact' | 'fuzzy';
};

export type SearchOutcome = {
  results: GolfCourseResult[];
  error?: 'rate-limited' | 'fetch-error';
};

type NominatimRaw = {
  display_name?: string;
  lat?: string | number;
  lon?: string | number;
  class?: string;
  type?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    municipality?: string;
  };
  extratags?: { sport?: string };
};

type ParsedRaw = {
  name: string;
  lat: number;
  lon: number;
  address: string;
  _osmClass: string | null;
  _osmType: string | null;
  _osmSport: string | null;
};

const cache = new Map<string, GolfCourseResult[]>();

export async function searchGolfCourse(query: string): Promise<SearchOutcome> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return { results: [] };

  const key = trimmed.toLowerCase();
  if (cache.has(key)) return { results: cache.get(key)! };

  const first = await fetchProxy(trimmed);
  if (first.error) return { results: [], error: first.error };

  let parsed = first.raw.map(toParsed);
  let golf = filterToGolf(parsed);

  // Fallback: append "golf course" if the raw query produced nothing
  // golf-tagged. The proxy's own throttle already enforces ≥1.1s spacing.
  if (golf.length === 0 && !key.includes('golf')) {
    const fallback = await fetchProxy(`${trimmed} golf course`);
    if (fallback.error) {
      // Still cache+return the fuzzy first-call results — better than nothing.
      const final = bestFuzzy(parsed);
      cache.set(key, final);
      return { results: final, error: fallback.error };
    }
    parsed = fallback.raw.map(toParsed);
    golf = filterToGolf(parsed);
  }

  const final = golf.length > 0 ? golf : bestFuzzy(parsed);
  cache.set(key, final);
  return { results: final };
}

async function fetchProxy(
  query: string,
): Promise<{ raw: NominatimRaw[]; error?: 'rate-limited' | 'fetch-error' }> {
  try {
    const res = await fetch(`/api/golf-search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return { raw: [], error: 'fetch-error' };
    const data = await res.json();
    if (!data.ok) {
      if (data.reason === 'rate-limited') return { raw: [], error: 'rate-limited' };
      return { raw: [], error: 'fetch-error' };
    }
    return { raw: (data.results ?? []) as NominatimRaw[] };
  } catch {
    return { raw: [], error: 'fetch-error' };
  }
}

function toParsed(r: NominatimRaw): ParsedRaw {
  const lat = typeof r.lat === 'string' ? parseFloat(r.lat) : r.lat ?? 0;
  const lon = typeof r.lon === 'string' ? parseFloat(r.lon) : r.lon ?? 0;
  return {
    name: prettifyName(r.display_name ?? ''),
    lat,
    lon,
    address: formatAddress(r.address),
    _osmClass: r.class ?? null,
    _osmType: r.type ?? null,
    _osmSport: r.extratags?.sport ?? null,
  };
}

function filterToGolf(rows: ParsedRaw[]): GolfCourseResult[] {
  return rows
    .filter((r) => {
      // OSM tags golf courses as leisure=golf_course
      if (r._osmClass === 'leisure' && r._osmType === 'golf_course') return true;
      // Sometimes only the sport=golf extratag is set
      if (r._osmSport === 'golf') return true;
      // Name fallback for entities tagged differently
      const name = r.name.toLowerCase();
      if (name.includes('golf') || name.includes('country club') || name.includes('g.c.')) {
        return true;
      }
      return false;
    })
    .map(({ name, lat, lon, address }) => ({
      name,
      lat,
      lon,
      address,
      type: 'exact' as const,
    }));
}

function bestFuzzy(rows: ParsedRaw[]): GolfCourseResult[] {
  return rows.slice(0, 3).map(({ name, lat, lon, address }) => ({
    name,
    lat,
    lon,
    address,
    type: 'fuzzy' as const,
  }));
}

function prettifyName(displayName: string): string {
  if (!displayName) return '';
  const parts = displayName.split(',').map((s) => s.trim());
  return parts[0] || displayName;
}

function formatAddress(address: NominatimRaw['address']): string {
  if (!address) return '';
  const parts = [address.city || address.town || address.village || address.municipality, address.state]
    .filter(Boolean);
  return parts.join(', ');
}
