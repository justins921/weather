'use client';

// NWS Active Alerts — National Weather Service, US-only, no key.
// Endpoint returns watches/warnings/advisories near a coordinate; non-US
// locations (e.g., TPC Danzante Bay in Mexico) just return zero features
// and we render nothing.

export type Alert = {
  id: string;
  event: string;
  headline: string;
  description: string;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  urgency: 'Immediate' | 'Expected' | 'Future' | 'Past' | 'Unknown';
  expiresAt: string | null;
  endsAt: string | null;
};

type NWSResponse = {
  features?: Array<{
    id?: string;
    properties?: {
      event?: string;
      headline?: string;
      description?: string;
      severity?: string;
      urgency?: string;
      expires?: string | null;
      ends?: string | null;
    };
  }>;
};

export async function fetchAlerts(lat: number, lon: number): Promise<Alert[]> {
  // NWS occasionally rejects requests without an Accept header on geo+json.
  const url = `https://api.weather.gov/alerts/active?point=${lat},${lon}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/geo+json' },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as NWSResponse;
    return (data.features ?? [])
      .map((f) => ({
        id: f.id ?? '',
        event: f.properties?.event ?? '',
        headline: f.properties?.headline ?? f.properties?.event ?? '',
        description: f.properties?.description ?? '',
        severity: (f.properties?.severity ?? 'Unknown') as Alert['severity'],
        urgency: (f.properties?.urgency ?? 'Unknown') as Alert['urgency'],
        expiresAt: f.properties?.expires ?? null,
        endsAt: f.properties?.ends ?? null,
      }))
      .filter((a) => a.event)
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  } catch {
    return [];
  }
}

export function severityRank(s: Alert['severity']): number {
  if (s === 'Extreme') return 4;
  if (s === 'Severe') return 3;
  if (s === 'Moderate') return 2;
  if (s === 'Minor') return 1;
  return 0;
}

export function alertColor(severity: Alert['severity']): string {
  if (severity === 'Extreme') return '#dc2626';
  if (severity === 'Severe') return '#ef4444';
  if (severity === 'Moderate') return '#f97316';
  if (severity === 'Minor') return '#eab308';
  return '#6b7280';
}

export function alertEmoji(event: string): string {
  const e = event.toLowerCase();
  if (e.includes('tornado')) return '🌪️';
  if (e.includes('thunderstorm')) return '⛈️';
  if (e.includes('flood')) return '🌊';
  if (e.includes('heat')) return '🥵';
  if (e.includes('hurricane') || e.includes('tropical')) return '🌀';
  if (e.includes('wind')) return '💨';
  if (e.includes('blizzard') || e.includes('snow') || e.includes('winter')) return '❄️';
  if (e.includes('fog')) return '🌫️';
  if (e.includes('fire')) return '🔥';
  if (e.includes('dust')) return '🏜️';
  if (e.includes('freeze') || e.includes('frost')) return '🥶';
  return '⚠️';
}
