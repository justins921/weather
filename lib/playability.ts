// Playability: 0-100 score for whether you should be on the course.
// Tweak CONFIG to taste.
export const CONFIG = {
  TEMP_LOW_PENALTY_BELOW: 50,
  TEMP_HIGH_PENALTY_ABOVE: 90,
  WIND_PENALTY_ABOVE: 10,
  GUST_DELTA_PENALTY_ABOVE: 8,
  GUST_DELTA_MULTIPLIER: 1.5,
  PRECIP_MULTIPLIER: 0.8,
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
};

export type PlayabilityResult = {
  score: number;
  label: string;
  color: string;
};

export function playability(i: PlayabilityInputs): PlayabilityResult {
  let score = 100;

  // Temp pain on either end.
  if (i.apparent_temp < CONFIG.TEMP_LOW_PENALTY_BELOW) {
    score -= (CONFIG.TEMP_LOW_PENALTY_BELOW - i.apparent_temp) * 2;
  } else if (i.apparent_temp > CONFIG.TEMP_HIGH_PENALTY_ABOVE) {
    score -= (i.apparent_temp - CONFIG.TEMP_HIGH_PENALTY_ABOVE) * 2;
  }

  // Wind: penalize anything over the threshold by mph.
  if (i.wind_speed > CONFIG.WIND_PENALTY_ABOVE) {
    score -= i.wind_speed;
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
