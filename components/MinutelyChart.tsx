import type { MinutelyBlock } from '@/lib/types';
import { fmtHourLocal } from '@/lib/format';

type Props = {
  minutely: MinutelyBlock;
  timezone?: string;
};

export default function MinutelyChart({ minutely, timezone }: Props) {
  // Show next 6 hours (24 fifteen-min slots).
  const nowMs = Date.now();
  let start = 0;
  for (let i = 0; i < minutely.time.length; i++) {
    if (new Date(minutely.time[i]).getTime() >= nowMs) {
      start = i;
      break;
    }
  }
  const slots = minutely.time.slice(start, start + 24);
  const precip = minutely.precipitation.slice(start, start + 24);

  let headline = 'No rain expected in the next 6 hours.';
  const firstWet = precip.findIndex((p) => p > 0.005);
  if (firstWet >= 0) {
    const minsAhead = firstWet * 15;
    if (firstWet === 0) {
      const lastWet = [...precip].reverse().findIndex((p) => p > 0.005);
      const endIdx = lastWet === -1 ? slots.length - 1 : slots.length - 1 - lastWet;
      headline = `Rain through ${fmtHourLocal(slots[endIdx], timezone)}.`;
    } else {
      headline = `Rain starting in ${minsAhead} min.`;
    }
  }

  const max = Math.max(0.05, ...precip);

  return (
    <section className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        Next 6 hours
      </div>
      <div className="mt-1 text-base">{headline}</div>
      <div className="mt-3 flex h-12 items-end gap-0.5">
        {precip.map((p, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-cyan-500/80 dark:bg-cyan-400/80"
            style={{ height: `${(p / max) * 100}%`, minHeight: p > 0 ? '2px' : '0' }}
            title={`${p.toFixed(2)}"`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-fg-light/50 dark:text-fg-dark/50">
        <span>now</span>
        <span>+3h</span>
        <span>+6h</span>
      </div>
    </section>
  );
}
