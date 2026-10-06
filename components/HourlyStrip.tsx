import HourCell from './HourCell';
import TempCurve from './TempCurve';
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
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <div className="section-label">Hourly Forecast</div>
        <div className="text-xs font-medium text-accent-light dark:text-accent-dark">Next 48 hours</div>
      </div>
      <div className="no-scrollbar -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5">
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
            isDay={h.is_day?.[i]}
            humidity={h.relative_humidity_2m[i]}
            dewPoint={h.dew_point_2m[i]}
          />
        ))}
      </div>
      <div className="mt-2">
        <TempCurve temps={idx.map((i) => h.temperature_2m[i])} />
      </div>
    </section>
  );
}
