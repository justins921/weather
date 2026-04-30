// Rules-based narrative generator. No LLM. Edit the strings to taste.
import { clubsForWind, formatClubs } from './clubWind';
import { isObsRecent, minutelyPrecipNow, type Observation } from './observations';
import { pressureTrend } from './pressureTrend';
import type { Forecast } from './types';
import { weatherLabel } from './weatherCodes';

// Priority for "Right now":
//   1. Live radar (minutely_15) showing measurable precip in the current slot
//   2. NWS station observation textDescription (when fresh)
//   3. Forecast model weather_code (fallback)
export function rightNowSentence(f: Forecast, obs?: Observation | null): string {
  if (f.minutely_15) {
    const p = minutelyPrecipNow(f.minutely_15.time, f.minutely_15.precipitation);
    if (p > 0.005) {
      // Try to refine wording from the obs if it's fresh.
      if (isObsRecent(obs ?? null) && obs?.textDescription) {
        return ensureDot(obs.textDescription);
      }
      return 'Raining.';
    }
  }
  if (isObsRecent(obs ?? null) && obs?.textDescription) {
    return ensureDot(obs.textDescription);
  }
  return weatherLabel(f.current.weather_code, f.current.cloud_cover);
}

function ensureDot(s: string): string {
  return /[.!?]$/.test(s.trim()) ? s.trim() : s.trim() + '.';
}

function fmtHour(iso: string, timezone?: string): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', timeZone: timezone };
  return new Intl.DateTimeFormat('en-US', opts).format(d).toLowerCase().replace(' ', '');
}

export function comingUpSentence(f: Forecast): string {
  const tz = f.timezone;
  const h = f.hourly;
  // Index 0 of hourly may be earlier today (Open-Meteo gives full day). Find "now" index.
  const nowMs = Date.now();
  let start = 0;
  for (let i = 0; i < h.time.length; i++) {
    if (new Date(h.time[i]).getTime() >= nowMs) {
      start = Math.max(0, i - 1);
      break;
    }
  }
  const window12 = Math.min(h.time.length, start + 12);
  const slice = <T,>(arr: T[]) => arr.slice(start, window12);

  const probs = slice(h.precipitation_probability);
  const precips = slice(h.precipitation);
  const winds = slice(h.wind_speed_10m);
  const gusts = slice(h.wind_gusts_10m);
  const temps = slice(h.temperature_2m);
  const clouds = slice(h.cloud_cover);
  const times = slice(h.time);

  const currentPrecip = f.current.precipitation;

  // 1. Precip starting: dry now, wet within 12h.
  if (currentPrecip < 0.01) {
    const startIdx = precips.findIndex((p, idx) => p > 0.01 || probs[idx] >= 50);
    if (startIdx > 0) {
      return `Rain starting around ${fmtHour(times[startIdx], tz)}.`;
    }
  }

  // 1.5. Pressure crash: surfaces an early heads-up before rule #2 fires.
  // We look at the actual hourly array (not the 12h forward slice) so we can
  // compare current pressure to 6 hours ago using the past_hours data.
  if (currentPrecip < 0.01 && h.surface_pressure && h.surface_pressure.length) {
    const nowMs = Date.now();
    let nowIdx = -1;
    for (let i = 0; i < h.time.length; i++) {
      if (new Date(h.time[i]).getTime() >= nowMs) {
        nowIdx = Math.max(0, i - 1);
        break;
      }
    }
    if (nowIdx >= 1) {
      const sixAgoIdx = Math.max(0, nowIdx - 6);
      const cur = h.surface_pressure[nowIdx];
      const past = h.surface_pressure[sixAgoIdx];
      if (typeof cur === 'number' && typeof past === 'number') {
        const t = pressureTrend(cur, past);
        if (t.label === 'Falling fast') {
          return 'Pressure dropping — weather likely changing in the next few hours.';
        }
      }
    }
  }

  // 2. Precip ending: wet now, dry by some hour.
  if (currentPrecip > 0.01) {
    const endIdx = precips.findIndex((p, idx) => p < 0.01 && probs[idx] < 30);
    if (endIdx > 0) {
      return `Rain easing by ${fmtHour(times[endIdx], tz)}.`;
    }
  }

  // 3. Wind shift: 8mph+ jump within any 6h slice.
  const baselineWind = winds[0] ?? 0;
  let peakWind = baselineWind;
  let peakWindIdx = 0;
  for (let i = 1; i < Math.min(6, winds.length); i++) {
    if (winds[i] > peakWind) {
      peakWind = winds[i];
      peakWindIdx = i;
    }
  }
  if (peakWind - baselineWind >= 8) {
    // Mention club-wind only when the peak is meaningful (>= 11mph maps to 1.5+ clubs).
    const clubs = peakWind >= 11 ? formatClubs(clubsForWind(peakWind)).toLowerCase() : null;
    const clubPart = clubs ? ` (${clubs})` : '';
    return `Winds picking up to ${Math.round(peakWind)}mph${clubPart} by ${fmtHour(times[peakWindIdx], tz)}.`;
  }

  // 4. Temp swing: >20F over the 12h window.
  if (temps.length >= 2) {
    const tMax = Math.max(...temps);
    const tMin = Math.min(...temps);
    const first = temps[0];
    if (tMax - tMin > 20) {
      if (tMax - first > 20) {
        return `Warming to ${Math.round(tMax)}° this afternoon.`;
      }
      if (first - tMin > 20) {
        return `Cooling to ${Math.round(tMin)}° by tonight.`;
      }
    }
  }

  // 5. Cloud change: 40%+ shift in the first 6h.
  if (clouds.length >= 6) {
    const c0 = clouds[0];
    const c6 = clouds[5];
    if (c0 - c6 >= 40) return 'Clouds breaking for sun this afternoon.';
    if (c6 - c0 >= 40) return 'Clouds rolling in this afternoon.';
  }

  // 6. Default: lean on the day's high.
  const dayMax = f.daily.temperature_2m_max[0];
  const peakGust = Math.max(...gusts);
  if (peakGust >= 18) {
    return `Breezy with gusts to ${Math.round(peakGust)}mph, high near ${Math.round(dayMax)}°.`;
  }
  return `Plenty of sunshine, high near ${Math.round(dayMax)}°.`;
}

export function dewPointLabel(dp: number): string {
  if (dp < 55) return 'Dry';
  if (dp < 65) return 'Comfortable';
  if (dp < 70) return 'Sticky';
  if (dp < 75) return 'Muggy';
  return 'Soup';
}

export function windCardinal(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export function windArrow(deg: number): string {
  // Arrow pointing in direction wind is going (deg = direction wind comes FROM, so add 180).
  const arrows = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
  return arrows[Math.round(deg / 45) % 8];
}

export function weeklyHeadline(daily: Forecast['daily']): string {
  const high = Math.round(Math.max(...daily.temperature_2m_max));
  const low = Math.round(Math.min(...daily.temperature_2m_min));
  return `Highs reaching ${high}°, with a low of ${low}° this week.`;
}
