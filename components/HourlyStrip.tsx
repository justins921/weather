import HourCell from './HourCell';
import type { Forecast } from '@/lib/types';

type Props = {
  forecast: Forecast;
};

export default function HourlyStrip({ forecast }: Props) {
  const h = forecast.hourly;
  const nowMs = Date.now();
  let start = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (new Date(h.time[i]).getTime() >= nowMs) {
      start = Math.max(0, i - 1);
      break;
    }
  }
  const end = Math.min(h.time.length, start + 48);
  const idx = Array.from({ length: end - start }, (_, i) => start + i);

  return (
    <section className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        Next 48 hours
      </div>
      <div className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
        {idx.map((i) => (
          <HourCell
            key={h.time[i]}
            iso={h.time[i]}
            timezone={forecast.timezone}
            temp={h.temperature_2m[i]}
            apparent={h.apparent_temperature[i]}
            precipProb={h.precipitation_probability[i] ?? 0}
            weatherCode={h.weather_code[i]}
            windSpeed={h.wind_speed_10m[i]}
            windDir={h.wind_direction_10m[i]}
            gusts={h.wind_gusts_10m[i]}
            cloudCover={h.cloud_cover[i]}
            humidity={h.relative_humidity_2m[i]}
            dewPoint={h.dew_point_2m[i]}
          />
        ))}
      </div>
    </section>
  );
}
