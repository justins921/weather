'use client';

import {
  pollenLevelOrder,
  type PollenForecast,
  type PollenReading,
} from '@/lib/airQuality';

type Props = {
  pollen: PollenForecast | null;
  // Used to render local-time hour labels for peak time.
  timezone?: string;
};

const SPECIES_LABEL: Record<string, string> = {
  alder: 'Alder',
  birch: 'Birch',
  grass: 'Grass',
  mugwort: 'Mugwort',
  olive: 'Olive',
  ragweed: 'Ragweed',
};

const LEVEL_LABEL: Record<string, string> = {
  none: 'None',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  'very-high': 'Very High',
};

// Renders only when at least one species is currently moderate+ OR will
// peak moderate+ within the next 24 h. Otherwise pollen is just noise.
export default function PollenCard({ pollen, timezone }: Props) {
  if (!pollen) return null;
  const meaningful = [...pollen.current, ...pollen.peak24h].some(
    (r) => pollenLevelOrder(r.level) >= 2,
  );
  if (!meaningful) return null;

  // Show top 2 species ranked by current level, then peak24h level as
  // tiebreaker. Skip "none"/"low".
  const ranked = [...pollen.current]
    .map((cur) => {
      const peak = pollen.peak24h.find((p) => p.type === cur.type);
      return { cur, peak };
    })
    .filter((x) => pollenLevelOrder(x.cur.level) >= 2 || (x.peak && pollenLevelOrder(x.peak.level) >= 2))
    .sort((a, b) => {
      const da = pollenLevelOrder(a.cur.level) + (a.peak ? pollenLevelOrder(a.peak.level) * 0.5 : 0);
      const db = pollenLevelOrder(b.cur.level) + (b.peak ? pollenLevelOrder(b.peak.level) * 0.5 : 0);
      return db - da;
    })
    .slice(0, 2);

  const headline = ranked
    .map(({ cur, peak }) => {
      const top = peak && pollenLevelOrder(peak.level) > pollenLevelOrder(cur.level) ? peak : cur;
      return `${SPECIES_LABEL[cur.type] ?? cur.type}: ${LEVEL_LABEL[top.level]}`;
    })
    .join(' · ');

  const advice = adviceFor(pollen, timezone);

  return (
    <section className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
          Pollen
        </div>
        <span aria-hidden>🌾</span>
      </div>
      <div className="mt-1 text-base font-semibold">{headline}</div>
      {advice && (
        <>
          <div className="my-2 h-px bg-black/10 dark:bg-white/10" />
          <div className="text-xs text-fg-light/70 dark:text-fg-dark/70">{advice}</div>
        </>
      )}
    </section>
  );
}

function adviceFor(pollen: PollenForecast, tz: string | undefined): string | null {
  // Only generate the recommendation copy when at least one species is
  // High or Very High. Otherwise the level chips above carry the load.
  const anyHigh = [...pollen.current, ...pollen.peak24h].some(
    (r) => pollenLevelOrder(r.level) >= 3,
  );
  if (!anyHigh) return null;

  // Find the highest current reading vs. the dominant peak.
  const dominantCurrent = [...pollen.current].sort(
    (a, b) => pollenLevelOrder(b.level) - pollenLevelOrder(a.level),
  )[0];
  const dominantPeak = [...pollen.peak24h].sort(
    (a, b) => pollenLevelOrder(b.level) - pollenLevelOrder(a.level),
  )[0];

  // Already at peak now (or very close to it).
  if (
    dominantCurrent &&
    dominantPeak &&
    pollenLevelOrder(dominantCurrent.level) >= 3 &&
    pollenLevelOrder(dominantCurrent.level) >= pollenLevelOrder(dominantPeak.level)
  ) {
    return 'At peak now — take antihistamine before heading out.';
  }

  // Easing through the day: highest reading is current, peak24h is lower.
  if (
    dominantCurrent &&
    dominantPeak &&
    pollenLevelOrder(dominantCurrent.level) > pollenLevelOrder(dominantPeak.level)
  ) {
    return 'Easing through the day — afternoon rounds will be more comfortable.';
  }

  if (!pollen.peakTime) {
    return 'Take antihistamine ~30 min before your round.';
  }

  // Map peak time to a rough morning / afternoon bucket using local time.
  const hour = localHour(pollen.peakTime, tz);
  if (hour < 10) {
    return 'Peaks mid-morning. Take antihistamine before an early tee time.';
  }
  return 'Peaks in the afternoon. Take antihistamine ~30 min before your round.';
}

function localHour(iso: string, tz: string | undefined): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: tz,
  });
  const parts = fmt.formatToParts(new Date(iso));
  const h = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const n = parseInt(h, 10);
  return n === 24 ? 0 : n;
}

// Helper for the wear advice modifier (lib/wear.ts) — exposes whether any
// species is High or Very High in the current hour or peak window.
export function pollenSummary(pollen: PollenForecast | null): {
  highOrAbove: boolean;
} {
  if (!pollen) return { highOrAbove: false };
  const highOrAbove = [...pollen.current, ...pollen.peak24h].some(
    (r) => pollenLevelOrder(r.level) >= 3,
  );
  return { highOrAbove };
}
