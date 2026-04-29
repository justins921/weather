import {
  carryMultiplier,
  playsColor,
  playsLabel,
  playsReason,
  playsYards,
  type ConditionsInput,
} from '@/lib/airDensity';

type Props = {
  inputs: ConditionsInput;
};

export default function AirDensityCard({ inputs }: Props) {
  const multiplier = carryMultiplier(inputs);
  const yards = playsYards(multiplier);
  const reason = playsReason(inputs);
  const color = playsColor(yards);

  return (
    <div className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        Air Density
      </div>
      <div className="mt-1 flex items-center justify-between text-xl font-semibold">
        <span style={color ? { color } : undefined}>{playsLabel(yards)}</span>
        <span className="text-base">🎯</span>
      </div>
      <div className="mt-1 text-xs text-fg-light/60 dark:text-fg-dark/60">{reason}</div>
    </div>
  );
}
