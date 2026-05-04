'use client';

import { useMemo } from 'react';
import { canFinishRound, isNearSunset, type FinishBuffer } from '@/lib/sunsetCalc';
import type { Forecast } from '@/lib/types';

type Props = {
  forecast: Forecast;
};

// Standalone "Can I tee off now?" card. Auto-hidden when sunset is more
// than 4 hours away — irrelevant in the morning. Also hidden when the
// finish buffer is "comfortable" (the message doesn't add anything new).
// Render at the top of the forecast page so the answer is the first
// thing the user sees when relevant.
export default function SunsetCheckWidget({ forecast }: Props) {
  const data = useMemo(() => {
    const sunset = nextSunsetIso(forecast);
    if (!sunset) return null;
    if (!isNearSunset(sunset, 4)) return null;
    const nowMs = Date.now();
    // Snap "now" to the current minute so the math is repeatable.
    const teeIso = isoFromUtc(new Date(nowMs));
    const check = canFinishRound(teeIso, sunset);
    return { check, sunset };
  }, [forecast]);

  if (!data) return null;
  if (data.check.buffer === 'comfortable') return null;

  const accent = colorFor(data.check.buffer);

  return (
    <section
      className="rounded-2xl bg-card-light p-4 dark:bg-card-dark"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        ⏱ Can I tee off now?
      </div>
      <p className="mt-2 text-sm">{data.check.message}</p>
      <p className="mt-1 text-xs text-fg-light/60 dark:text-fg-dark/60">
        Sunset {data.check.sunsetLabel}, you'd finish around{' '}
        {data.check.finishLabel}.
      </p>
    </section>
  );
}

function colorFor(buffer: FinishBuffer): string {
  switch (buffer) {
    case 'tight':
      return '#eab308';
    case 'rushed':
      return '#f97316';
    case 'impossible':
      return '#ef4444';
    case 'comfortable':
      return '#22c55e'; // not actually rendered (we early-return above)
  }
}

// First daily.sunset entry that's still in the future. Open-Meteo's
// daily.sunset uses the same location-local-no-offset convention as
// everything else, so we parse with a fake Z and compare to now in ms.
function nextSunsetIso(f: Forecast): string | null {
  const sunsets = f.daily?.sunset ?? [];
  const nowMs = Date.now();
  for (const s of sunsets) {
    const ms = new Date(/Z|[+-]\d{2}:\d{2}$/.test(s) ? s : s + 'Z').getTime();
    if (ms > nowMs) return s;
  }
  return null;
}

function isoFromUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
