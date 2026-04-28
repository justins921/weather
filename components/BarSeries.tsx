import { fmtHourLocal } from '@/lib/format';

type Props = {
  values: number[];
  // Bar color per index (lets caller use temp gradient or playability gradient).
  colorFn: (value: number, idx: number) => string;
  formatValue: (value: number) => string;
  // Optional ISO hour timestamps for the bottom labels.
  hours?: string[];
  timezone?: string;
  showHours?: boolean;
  // Show every Nth hour label (default 2 = every other).
  hourStride?: number;
  // Bar area pixel height (excludes value/hour label rows).
  height?: number;
  // Override the value range used to scale bar heights.
  scaleMin?: number;
  scaleMax?: number;
  // Minimum bar height in px so the lowest value still renders visibly.
  minBar?: number;
  ariaLabel?: string;
};

export default function BarSeries({
  values,
  colorFn,
  formatValue,
  hours,
  timezone,
  showHours = false,
  hourStride = 2,
  height = 36,
  scaleMin,
  scaleMax,
  minBar = 6,
  ariaLabel,
}: Props) {
  if (values.length === 0) return null;
  const lo = scaleMin ?? Math.min(...values);
  const hi = scaleMax ?? Math.max(...values);
  const span = Math.max(1, hi - lo);

  return (
    <div aria-label={ariaLabel}>
      <div className="flex gap-px">
        {values.map((v, i) => (
          <div
            key={i}
            className="flex-1 text-center text-[9px] font-medium leading-tight tabular-nums text-fg-light/80 dark:text-fg-dark/80"
          >
            {formatValue(v)}
          </div>
        ))}
      </div>
      <div className="mt-0.5 flex items-end gap-px" style={{ height }}>
        {values.map((v, i) => {
          const usable = Math.max(1, height - minBar);
          const h = ((v - lo) / span) * usable + minBar;
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm"
              style={{ height: `${h}px`, background: colorFn(v, i) }}
            />
          );
        })}
      </div>
      {showHours && hours && (
        <div className="mt-0.5 flex gap-px">
          {hours.map((iso, i) => (
            <div
              key={iso + i}
              className="flex-1 text-center text-[9px] leading-tight text-fg-light/50 dark:text-fg-dark/50"
            >
              {i % hourStride === 0 ? fmtHourLocal(iso, timezone) : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
