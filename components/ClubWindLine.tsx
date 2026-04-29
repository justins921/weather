import { clubsForWind, formatClubs } from '@/lib/clubWind';

type Props = {
  windSpeed: number;
  gusts: number;
};

// Renders the divider + club-wind line(s) under the wind card. Returns null
// when neither sustained nor gusts cross the 6mph noise floor — "No club"
// in both directions is just clutter.
export default function ClubWindLine({ windSpeed, gusts }: Props) {
  if (windSpeed < 6 && gusts < 6) return null;
  const sustained = clubsForWind(windSpeed);
  const peak = clubsForWind(gusts);

  const divider = <div className="my-2 h-px bg-black/10 dark:bg-white/10" />;

  // Calm sustained but gusts kick up: collapse to a single line so we don't
  // print "No club wind".
  if (sustained === 0 && peak > 0) {
    return (
      <>
        {divider}
        <div className="text-[11px]">
          🏌️ Calm with gusts to {formatClubs(peak).toLowerCase()}
        </div>
      </>
    );
  }

  // Use the adjectival form ("2 club wind") for the sustained line; keep the
  // plural for the gust line ("gusts to 2 clubs").
  const sustainedAdj = adjectival(formatClubs(sustained));

  return (
    <>
      {divider}
      <div className="text-[11px]">🏌️ {sustainedAdj} wind</div>
      {peak !== sustained && (
        <div className="text-[11px] text-fg-light/60 dark:text-fg-dark/60">
          Gusts to {formatClubs(peak).toLowerCase()}
        </div>
      )}
    </>
  );
}

function adjectival(label: string): string {
  // "2 clubs" -> "2 club"; "Half club" stays put; "3+ clubs" -> "3+ club".
  return label.endsWith(' clubs') ? label.slice(0, -1) : label;
}
