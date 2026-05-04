// Playability: 0-100 score for whether you should be on the course.
// Tweak CONFIG to taste.
export const CONFIG = {
  // Temperature comfort window (feels-like)
  TEMP_IDEAL_LOW: 67,
  TEMP_IDEAL_HIGH: 79,
  TEMP_BELOW_IDEAL_MULT: 2.5, // each degree below 67 costs 2.5
  TEMP_ABOVE_IDEAL_MULT: 1.8, // each degree above 79 costs 1.8
  TEMP_COLD_CLIFF: 50, // additional -10 below this
  TEMP_MISERABLE_CLIFF: 40, // additional -15 below this
  TEMP_HOT_CLIFF: 90, // additional -10 above this

  // Wind
  WIND_PENALTY_ABOVE: 10, // -1 per mph above 10
  WIND_HEAVY_ABOVE: 15, // additional -1 per mph above 15
  GUST_DELTA_PENALTY_ABOVE: 8,
  GUST_DELTA_MULTIPLIER: 1.5,

  // Precipitation
  PRECIP_MULTIPLIER: 0.8,

  // Dew point
  DEW_POINT_SOUP: 70,
  DEW_POINT_MISERABLE: 75,
  DEW_POINT_DRY_COLD: 30,
};

export type PlayabilityInputs = {
  apparent_temp: number;
  wind_speed: number;
  wind_gusts: number;
  precip_probability: number;
  humidity: number;
  dew_point: number;
  cloud_cover: number;
  // 1 if the sun is up at this point in time, 0 if not. Defaults to 1
  // (assume daylight) so callers that don't pass it keep working.
  is_day?: number;
};

export type PlayabilityResult = {
  score: number;
  label: string;
  color: string;
};

export function playability(i: PlayabilityInputs): PlayabilityResult {
  // You can't play in the dark. Hard-zero the score and surface a label
  // that doesn't pretend the weather is the problem.
  if (i.is_day === 0) {
    return { score: 0, label: 'After dark', color: '#475569' };
  }

  let score = 100;

  // Temperature: penalize against an ideal feels-like window of 67-79°F,
  // with steeper cliffs at the cold and hot extremes.
  if (i.apparent_temp < CONFIG.TEMP_IDEAL_LOW) {
    score -= (CONFIG.TEMP_IDEAL_LOW - i.apparent_temp) * CONFIG.TEMP_BELOW_IDEAL_MULT;
    if (i.apparent_temp < CONFIG.TEMP_COLD_CLIFF) score -= 10;
    if (i.apparent_temp < CONFIG.TEMP_MISERABLE_CLIFF) score -= 15;
  } else if (i.apparent_temp > CONFIG.TEMP_IDEAL_HIGH) {
    score -= (i.apparent_temp - CONFIG.TEMP_IDEAL_HIGH) * CONFIG.TEMP_ABOVE_IDEAL_MULT;
    if (i.apparent_temp > CONFIG.TEMP_HOT_CLIFF) score -= 10;
  }

  // Wind: -1 per mph above 10, doubling above 15 (additional -1 per mph above 15).
  if (i.wind_speed > CONFIG.WIND_PENALTY_ABOVE) {
    score -= i.wind_speed - CONFIG.WIND_PENALTY_ABOVE;
  }
  if (i.wind_speed > CONFIG.WIND_HEAVY_ABOVE) {
    score -= i.wind_speed - CONFIG.WIND_HEAVY_ABOVE;
  }

  // Gust delta: gusty days play worse than steady winds.
  const gustDelta = i.wind_gusts - i.wind_speed;
  if (gustDelta > CONFIG.GUST_DELTA_PENALTY_ABOVE) {
    score -= gustDelta * CONFIG.GUST_DELTA_MULTIPLIER;
  }

  // Precip probability: even chance of rain hurts plans.
  score -= i.precip_probability * CONFIG.PRECIP_MULTIPLIER;

  // Dew point: humidity that you actually feel.
  if (i.dew_point >= CONFIG.DEW_POINT_SOUP) {
    score -= (i.dew_point - 65) * 2;
    if (i.dew_point >= CONFIG.DEW_POINT_MISERABLE) score -= 10;
  } else if (i.dew_point < CONFIG.DEW_POINT_DRY_COLD && i.apparent_temp < 50) {
    score -= 5;
  }

  // Humidity catch for warm-but-not-tropical days.
  if (i.humidity > 85 && i.dew_point < CONFIG.DEW_POINT_SOUP) {
    score -= 5;
  }

  // Cloud cover for golf is usually a non-issue or even a positive — easier
  // reads, less heat, less squinting. Only nudge the score when clouds
  // correlate with conditions that actually hurt:
  //   - hot day + cloudy → small bonus (welcome shade)
  //   - cold day + overcast → small penalty (gloomy, hands-cold combo)
  // Otherwise neutral. NB: this is a deliberate departure from the broad
  // cloud-cover penalty most weather apps apply.
  const cloudCover = i.cloud_cover ?? 0;
  if (i.apparent_temp >= 80 && cloudCover >= 50) {
    score += 3;
  } else if (i.apparent_temp < 55 && cloudCover >= 80) {
    score -= 4;
  }

  score = Math.max(0, Math.round(score));
  return { score, ...labelFor(score) };
}

function labelFor(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Send it', color: '#22c55e' };
  if (score >= 60) return { label: 'Playable', color: '#84cc16' };
  if (score >= 40) return { label: 'Grinding', color: '#eab308' };
  if (score >= 20) return { label: 'Rough', color: '#f97316' };
  return { label: "Don't bother", color: '#ef4444' };
}

// Compute one playability score per hour starting at the current local
// hour, for as many hours as the forecast carries (typically 24 or
// more). Returns an array of { time, score } samples ready for
// findBestWindow / findBestTeeTime. Importing components should wrap
// this in `useMemo` so it isn't recomputed every render.
import type { Forecast } from './types';
export function computeHourlyPlayability(
  f: Forecast,
  hours: number = 24,
): { time: string; score: number }[] {
  const h = f.hourly;
  // Match the rest of the codebase's "find current hour" convention:
  // bare `new Date(iso)` interprets Open-Meteo's location-local strings
  // as browser-local, and we compare to Date.now(). For users whose
  // browser timezone matches the location's, this lands on the right
  // hour. Forcing UTC here (an earlier attempt) put us 5 hours off and
  // is the root cause of the BestTeeTime / chart mismatch.
  const nowMs = Date.now();
  const currentHourMs = nowMs - (nowMs % 3600000);
  let start = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (new Date(h.time[i]).getTime() >= currentHourMs) {
      start = i;
      break;
    }
  }
  const out: { time: string; score: number }[] = [];
  const end = Math.min(h.time.length, start + hours);
  for (let i = start; i < end; i++) {
    const result = playability({
      apparent_temp: h.apparent_temperature[i],
      wind_speed: h.wind_speed_10m[i],
      wind_gusts: h.wind_gusts_10m[i],
      precip_probability: h.precipitation_probability[i] ?? 0,
      humidity: h.relative_humidity_2m[i],
      dew_point: h.dew_point_2m[i],
      cloud_cover: h.cloud_cover[i],
      is_day: h.is_day?.[i],
    });
    out.push({ time: h.time[i], score: result.score });
  }
  return out;
}

/*
Sanity check — actual computed scores under the formulas above
(humidity defaulted to 50, gusts default to wind when not specified):

  73°F feels, 5mph wind,                    0% precip, 55° dew → 100  ("Send it")    | spec ~100
  67°F feels, 8mph wind,                    0% precip, 50° dew → 100  ("Send it")    | spec ~100
  60°F feels, 10mph wind,                   0% precip, 50° dew →  83  ("Send it")    | spec  ~82
  55°F feels, 12mph wind,                   0% precip, 50° dew →  68  ("Playable")   | spec  ~68
  46°F feels, 19mph wind, 32mph gusts,      0% precip, 42° dew →   5  ("Don't bother")| spec  ~25
  85°F feels, 8mph wind,                    0% precip, 65° dew →  89  ("Send it")    | spec  ~89
  92°F feels, 6mph wind,                    0% precip, 72° dew →  53  ("Grinding")   | spec  ~55

Six of seven land within ~3 of the spec's expected. Case 5 lands harsher
because the 13mph gust delta + cold cliff + doubled-above-15 wind stack on
top of an already-cold base. If 5 feels too punitive, the easiest dial is
GUST_DELTA_MULTIPLIER (try 1.0) or apply (gust_delta - threshold) instead
of full delta — both pull case 5 closer to ~25 without affecting the
others.
*/
