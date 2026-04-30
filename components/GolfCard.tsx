import {
  carryMultiplier,
  playsColor,
  playsLabel,
  playsReason,
  playsYards,
  type ConditionsInput,
} from '@/lib/airDensity';
import { airQualityHint, type AirQuality } from '@/lib/airQuality';
import { clubsForWind, formatClubs } from '@/lib/clubWind';
import { courseConditions } from '@/lib/courseConditions';
import type { PlayabilityResult } from '@/lib/playability';

type Props = {
  playability: PlayabilityResult;
  windSpeed: number;
  gusts: number;
  airInputs: ConditionsInput;
  // Optional supplementary signals — render only when meaningful.
  soilMoisture?: number;
  airQuality?: AirQuality | null;
  // Slimmer chrome for use as a sub-card inside an existing card (dashboard).
  compact?: boolean;
};

// Single card with the three golf-specific readouts:
//   - Playability score
//   - Club-wind translation
//   - Air-density "plays" yardage
export default function GolfCard({
  playability,
  windSpeed,
  gusts,
  airInputs,
  soilMoisture,
  airQuality,
  compact,
}: Props) {
  const sustained = clubsForWind(windSpeed);
  const peak = clubsForWind(gusts);
  const skipClubs = windSpeed < 6 && gusts < 6;

  const multiplier = carryMultiplier(airInputs);
  const yards = playsYards(multiplier);
  const ydsColor = playsColor(yards);
  const reason = playsReason(airInputs);

  const course = courseConditions(soilMoisture);
  const aq = airQualityHint(airQuality ?? null);

  const wrapper = compact
    ? 'rounded-xl bg-black/5 p-3 dark:bg-white/5'
    : 'rounded-2xl bg-card-light p-4 dark:bg-card-dark';

  return (
    <section className={wrapper}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        Golf
      </div>
      <div className="mt-1 divide-y divide-black/10 dark:divide-white/10">
        <Row label="Playability" hint={playabilityHint(playability.score)}>
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ background: playability.color }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
            {playability.label} · {playability.score}
          </span>
        </Row>
        {course && (
          <Row label="Course" hint={course.hint}>
            <span className="text-sm font-semibold">{courseEmoji(course.level)} {course.label}</span>
          </Row>
        )}
        {!skipClubs && (
          <Row label="Club Wind" hint={clubHint(sustained, peak)}>
            <ClubReadout sustained={sustained} peak={peak} />
          </Row>
        )}
        <Row label="Air Density" hint={reason}>
          <span
            className="text-sm font-semibold"
            style={ydsColor ? { color: ydsColor } : undefined}
          >
            🎯 {playsLabel(yards)}
          </span>
        </Row>
        {aq && (
          <Row label="Air Quality" hint={aq.hint}>
            <span className="text-sm font-semibold" style={{ color: aq.color }}>
              😷 {aq.label}
            </span>
          </Row>
        )}
      </div>
    </section>
  );
}

function courseEmoji(level: 'firm' | 'normal' | 'soft' | 'saturated'): string {
  if (level === 'saturated') return '🌊';
  if (level === 'soft') return '💧';
  if (level === 'firm') return '🔥';
  return '🟢';
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
          {label}
        </div>
        <div className="truncate text-xs text-fg-light/60 dark:text-fg-dark/60">{hint}</div>
      </div>
      <div className="shrink-0 text-right">{children}</div>
    </div>
  );
}

function ClubReadout({ sustained, peak }: { sustained: number; peak: number }) {
  if (sustained === 0 && peak > 0) {
    return (
      <span className="text-sm font-semibold">
        🏌️ Calm + gusts to {formatClubs(peak).toLowerCase()}
      </span>
    );
  }
  const sustainedLabel = adjectival(formatClubs(sustained));
  return (
    <div>
      <div className="text-sm font-semibold">🏌️ {sustainedLabel} wind</div>
      {peak !== sustained && (
        <div className="text-[11px] text-fg-light/60 dark:text-fg-dark/60">
          Gusts to {formatClubs(peak).toLowerCase()}
        </div>
      )}
    </div>
  );
}

function adjectival(label: string): string {
  return label.endsWith(' clubs') ? label.slice(0, -1) : label;
}

function playabilityHint(score: number): string {
  if (score >= 80) return 'Conditions are right for a round';
  if (score >= 60) return 'Solid round, manageable conditions';
  if (score >= 40) return 'Workable but expect a grind';
  if (score >= 20) return 'Tough out there today';
  return 'Maybe stay home';
}

function clubHint(sustained: number, peak: number): string {
  if (peak >= 3) return 'Distance control is a guess today';
  if (sustained >= 1.5 || peak >= 1.5) return 'Plan for the wind on every shot';
  return 'Subtle wind effect';
}
