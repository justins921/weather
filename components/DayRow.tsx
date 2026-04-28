import { fmtDateShort, fmtDayShort, fmtPct, fmtTemp } from '@/lib/format';
import { weatherEmoji } from '@/lib/weatherCodes';
import TempBar from './TempBar';

type Props = {
  iso: string;
  timezone?: string;
  weatherCode: number;
  cloudCover?: number;
  high: number;
  low: number;
  precipProb: number;
  weekMin: number;
  weekMax: number;
  isToday?: boolean;
};

export default function DayRow(p: Props) {
  return (
    <div className="grid grid-cols-[64px_28px_56px_1fr] items-center gap-3 py-2">
      <div className="text-sm">
        <div className="font-medium">{p.isToday ? 'Today' : fmtDayShort(p.iso, p.timezone)}</div>
        <div className="text-[11px] text-fg-light/50 dark:text-fg-dark/50">
          {fmtDateShort(p.iso, p.timezone)}
        </div>
      </div>
      <div className="text-center text-lg">{weatherEmoji(p.weatherCode, p.cloudCover ?? 0)}</div>
      <div className="text-center text-xs">
        {p.precipProb >= 10 ? (
          <div className="text-cyan-600 dark:text-cyan-400">
            <div>{fmtPct(p.precipProb)}</div>
            <div className="mx-auto mt-0.5 h-0.5 w-8 rounded-full bg-cyan-600/40 dark:bg-cyan-400/40" />
          </div>
        ) : (
          <span className="text-fg-light/30 dark:text-fg-dark/30">—</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="w-8 text-right text-sm text-fg-light/60 dark:text-fg-dark/60">
          {fmtTemp(p.low)}
        </span>
        <div className="flex-1">
          <TempBar
            values={[]}
            min={p.weekMin}
            max={p.weekMax}
            range={{ low: p.low, high: p.high }}
          />
        </div>
        <span className="w-8 text-sm font-semibold">{fmtTemp(p.high)}</span>
      </div>
    </div>
  );
}
