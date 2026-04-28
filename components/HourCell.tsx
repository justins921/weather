import { fmtHourLocal, fmtMph, fmtPct, fmtTemp } from '@/lib/format';
import { weatherEmoji } from '@/lib/weatherCodes';
import { windArrow } from '@/lib/narrative';
import { playability } from '@/lib/playability';

type Props = {
  iso: string;
  timezone?: string;
  temp: number;
  apparent: number;
  precipProb: number;
  weatherCode: number;
  windSpeed: number;
  windDir: number;
  gusts: number;
  cloudCover: number;
  humidity: number;
  dewPoint: number;
};

export default function HourCell(p: Props) {
  const score = playability({
    apparent_temp: p.apparent,
    wind_speed: p.windSpeed,
    wind_gusts: p.gusts,
    precip_probability: p.precipProb,
    humidity: p.humidity,
    dew_point: p.dewPoint,
    cloud_cover: p.cloudCover,
  });
  // Subtle score-based tint behind cell.
  const tint = `${score.color}22`;
  return (
    <div
      className="flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl px-2 py-3 text-center"
      style={{ background: tint }}
    >
      <div className="text-[11px] font-medium text-fg-light/70 dark:text-fg-dark/70">
        {fmtHourLocal(p.iso, p.timezone)}
      </div>
      <div className="text-xl leading-none">{weatherEmoji(p.weatherCode, p.cloudCover)}</div>
      <div className="text-base font-semibold">{fmtTemp(p.temp)}</div>
      <div className="text-[10px] leading-tight text-fg-light/60 dark:text-fg-dark/60">
        <span>{windArrow(p.windDir)}</span> {fmtMph(p.windSpeed)}
      </div>
      {p.precipProb >= 10 && (
        <div className="text-[10px] text-cyan-600 dark:text-cyan-400">{fmtPct(p.precipProb)}</div>
      )}
    </div>
  );
}
