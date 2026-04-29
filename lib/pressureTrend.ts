// Pressure trend: compare current surface_pressure to the value 6 hours ago
// (or the oldest available). A falling barometer means weather is coming.

export type PressureTrendResult = {
  direction: 'rising' | 'falling' | 'steady';
  deltaHpa: number;
  label: string;
};

export function pressureTrend(
  currentHpa: number,
  sixHoursAgoHpa: number,
): PressureTrendResult {
  const delta = currentHpa - sixHoursAgoHpa;
  const absDelta = Math.abs(delta);

  if (absDelta < 1) {
    return { direction: 'steady', deltaHpa: delta, label: 'Steady pressure' };
  }
  if (delta > 0) {
    const intensity = absDelta >= 3 ? 'Rising fast' : 'Rising';
    return { direction: 'rising', deltaHpa: delta, label: intensity };
  }
  const intensity = absDelta >= 3 ? 'Falling fast' : 'Falling';
  return { direction: 'falling', deltaHpa: delta, label: intensity };
}

export function pressureArrow(direction: PressureTrendResult['direction']): string {
  if (direction === 'rising') return '↗';
  if (direction === 'falling') return '↘';
  return '→';
}

export function pressureColor(label: string): string | null {
  if (label === 'Falling fast') return '#f97316'; // storm warning
  if (label === 'Falling') return '#eab308';
  if (label === 'Rising' || label === 'Rising fast') return '#22c55e';
  return null; // steady -> default text
}

/*
Sanity check — actual computed values from this implementation:

  1014 hPa now, 1015 hPa 6h ago  ->  delta -1   "Falling"        (|delta|=1, just trips the steady threshold of <1)
  1009 hPa now, 1014 hPa 6h ago  ->  delta -5   "Falling fast"   (|delta|>=3)
  1018 hPa now, 1014 hPa 6h ago  ->  delta +4   "Rising fast"    (|delta|>=3)

  The spec sketched the third case as "Rising" (+4 under fast threshold) and
  flagged its own arithmetic for re-check; +4 >= 3 so it's "Rising fast".
  The first case sat right at the steady boundary (|delta|=1, condition
  <1) — a 1 hPa drop counts as "Falling", not "Steady". If 1 hPa changes
  feel too sensitive, raise the steady threshold to <2 (covers the noisy
  ±1 hPa hourly jitter that's common in real data).
*/
