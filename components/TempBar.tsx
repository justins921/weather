import { tempColor } from '@/lib/format';

type Props = {
  values: number[];
  // optional explicit min/max range to position bars within (week view)
  min?: number;
  max?: number;
  height?: number;
  // Render as a horizontal bar between low/high values within a fixed range.
  range?: { low: number; high: number };
};

// Used in two ways:
// 1. Vertical bars: pass `values` (per hour) — heights scaled to value.
// 2. Horizontal range bar: pass `range` + `min`/`max`.
export default function TempBar({ values, min, max, height = 64, range }: Props) {
  if (range && min !== undefined && max !== undefined) {
    const span = Math.max(1, max - min);
    const left = ((range.low - min) / span) * 100;
    const right = ((range.high - min) / span) * 100;
    const width = Math.max(4, right - left);
    return (
      <div className="relative h-1.5 w-full rounded-full bg-black/5 dark:bg-white/10">
        <div
          className="absolute top-0 h-1.5 rounded-full"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            background: `linear-gradient(to right, ${tempColor(range.low)}, ${tempColor(range.high)})`,
          }}
        />
      </div>
    );
  }

  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = Math.max(1, hi - lo);

  return (
    <div className="flex items-end gap-0.5" style={{ height }}>
      {values.map((v, i) => {
        const h = ((v - lo) / span) * (height - 8) + 8;
        return (
          <div
            key={i}
            className="flex-1 rounded-t-sm"
            style={{ height: `${h}px`, background: tempColor(v) }}
            title={`${Math.round(v)}°`}
          />
        );
      })}
    </div>
  );
}
