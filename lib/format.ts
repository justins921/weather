// Small format helpers shared across components.

export function fmtTemp(t: number | undefined | null): string {
  if (t === undefined || t === null || Number.isNaN(t)) return '—';
  return `${Math.round(t)}°`;
}

export function fmtMph(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  return `${Math.round(v)}mph`;
}

export function fmtPct(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '—';
  return `${Math.round(v)}%`;
}

// Open-Meteo with `timezone=auto` returns timestamps in the LOCATION'S
// local time without a UTC offset suffix:
//   hourly: "2026-05-04T15:00"
//   daily : "2026-05-04"
// `new Date(...)` interprets the first as the BROWSER'S local time and
// the second as UTC midnight. Either path quietly shifts the displayed
// hour or day off by one once you cross a timezone boundary (or render
// on a UTC server). To stay honest, we force the iso strings to be
// interpreted as if they were already UTC, then format in UTC — which
// preserves the calendar values verbatim.
function parseLocationLocal(iso: string): Date {
  // Daily values are date-only ("YYYY-MM-DD") — pin to noon UTC so we
  // never sit on a DST midnight edge.
  if (iso.length === 10) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
  }
  // Hourly values look like "YYYY-MM-DDTHH:mm[:ss]" with no offset.
  // Append Z to force UTC interpretation; we'll format in UTC so the
  // wall-clock value is preserved.
  const withZ = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z';
  return new Date(withZ);
}

export function fmtHourLocal(iso: string, _timezone?: string): string {
  // _timezone parameter kept for backwards compat; ignored on purpose —
  // see parseLocationLocal above for why.
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    timeZone: 'UTC',
  })
    .format(parseLocationLocal(iso))
    .toLowerCase()
    .replace(' ', '');
}

export function fmtDayShort(iso: string, _timezone?: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(parseLocationLocal(iso));
}

export function fmtDateShort(iso: string, _timezone?: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parseLocationLocal(iso));
}

// Beaufort scale label for a sustained or gust speed in mph. Used for
// the qualitative subtitle on the wind-gust tile ("Light Breeze" etc.).
export function beaufortLabel(mph: number): string {
  if (mph < 1) return 'Calm';
  if (mph < 4) return 'Light Air';
  if (mph < 8) return 'Light Breeze';
  if (mph < 13) return 'Gentle Breeze';
  if (mph < 19) return 'Moderate Breeze';
  if (mph < 25) return 'Fresh Breeze';
  if (mph < 32) return 'Strong Breeze';
  if (mph < 39) return 'Near Gale';
  if (mph < 47) return 'Gale';
  if (mph < 55) return 'Strong Gale';
  if (mph < 64) return 'Storm';
  return 'Hurricane Force';
}

// Visibility category from miles. Tuned for outdoor/golf relevance —
// over ~6 mi everything beyond the next fairway is sharp.
export function visibilityLabel(miles: number): string {
  if (miles < 1) return 'Very Poor';
  if (miles < 3) return 'Poor';
  if (miles < 6) return 'Moderate';
  if (miles < 10) return 'Good';
  return 'Excellent';
}

// Short UV category for a tile.
export function uvShort(uv: number): string {
  if (uv >= 11) return 'Extreme';
  if (uv >= 8) return 'Very High';
  if (uv >= 6) return 'High';
  if (uv >= 3) return 'Moderate';
  return 'Low';
}

export function uvColor(uv: number): string {
  if (uv >= 11) return '#7f1d1d';
  if (uv >= 8) return '#dc2626';
  if (uv >= 6) return '#f97316';
  if (uv >= 3) return '#eab308';
  return '#22c55e';
}

// Map a temperature in F to a color from the gradient.
export function tempColor(t: number): string {
  // Stops: 20 cold, 40 cool, 60 mild, 75 warm, 88 hot, 100 very hot.
  const stops: [number, string][] = [
    [20, '#3b82f6'],
    [40, '#06b6d4'],
    [60, '#84cc16'],
    [75, '#eab308'],
    [88, '#f97316'],
    [100, '#ef4444'],
  ];
  if (t <= stops[0][0]) return stops[0][1];
  if (t >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [a, ca] = stops[i];
    const [b, cb] = stops[i + 1];
    if (t >= a && t <= b) {
      const k = (t - a) / (b - a);
      return mixHex(ca, cb, k);
    }
  }
  return stops[2][1];
}

function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255;
  const ag = (pa >> 8) & 255;
  const ab = pa & 255;
  const br = (pb >> 16) & 255;
  const bg = (pb >> 8) & 255;
  const bb = pb & 255;
  const r = Math.round(ar + (br - ar) * k);
  const g = Math.round(ag + (bg - ag) * k);
  const bl = Math.round(ab + (bb - ab) * k);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

export function isSameLocalDay(aIso: string, bIso: string, _timezone?: string): boolean {
  const fmt = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  });
  return fmt.format(parseLocationLocal(aIso)) === fmt.format(parseLocationLocal(bIso));
}
