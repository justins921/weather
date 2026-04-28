import type { Forecast } from '@/lib/types';

type Props = {
  gfs: Forecast;
  ecmwf: Forecast;
};

// Compare GFS vs ECMWF over the next 48 hours. Surface a confidence label.
export default function ModelAgreement({ gfs, ecmwf }: Props) {
  const n = Math.min(48, gfs.hourly.time.length, ecmwf.hourly.time.length);
  let tempDiff = 0;
  let windDiff = 0;
  let precipDiff = 0;
  for (let i = 0; i < n; i++) {
    tempDiff += Math.abs(gfs.hourly.temperature_2m[i] - ecmwf.hourly.temperature_2m[i]);
    windDiff += Math.abs(gfs.hourly.wind_speed_10m[i] - ecmwf.hourly.wind_speed_10m[i]);
    precipDiff += Math.abs(
      (gfs.hourly.precipitation_probability[i] ?? 0) -
        (ecmwf.hourly.precipitation_probability[i] ?? 0),
    );
  }
  const tAvg = tempDiff / n;
  const wAvg = windDiff / n;
  const pAvg = precipDiff / n;

  let label = 'Models Disagree, check back tomorrow';
  let color = '#ef4444';
  if (tAvg <= 3 && wAvg <= 3 && pAvg <= 15) {
    label = 'High Confidence';
    color = '#22c55e';
  } else if (tAvg <= 6 && wAvg <= 6 && pAvg <= 30) {
    label = 'Moderate Confidence';
    color = '#eab308';
  }

  return (
    <section className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
          Model Agreement (48h)
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
          style={{ background: color }}
        >
          {label}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-black/5 p-2 dark:bg-white/5">
          <div className="text-[10px] uppercase tracking-wider opacity-60">Temp Δ</div>
          <div className="text-sm font-semibold">{tAvg.toFixed(1)}°</div>
        </div>
        <div className="rounded-xl bg-black/5 p-2 dark:bg-white/5">
          <div className="text-[10px] uppercase tracking-wider opacity-60">Wind Δ</div>
          <div className="text-sm font-semibold">{wAvg.toFixed(1)}mph</div>
        </div>
        <div className="rounded-xl bg-black/5 p-2 dark:bg-white/5">
          <div className="text-[10px] uppercase tracking-wider opacity-60">Precip Δ</div>
          <div className="text-sm font-semibold">{Math.round(pAvg)}%</div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-fg-light/50 dark:text-fg-dark/50">
        GFS vs ECMWF average absolute difference over the next 48 hours.
      </div>
    </section>
  );
}
