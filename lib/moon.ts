// Moon phase from a date. Computed locally — no API call needed and the
// answer is good to a few hours of accuracy, which is plenty for "is it
// a full moon tonight".
//
// Reference new moon: 2000-01-06 18:14 UTC. Synodic month = 29.530588853
// days. From those two constants we can locate any date inside the
// current cycle and pick a phase bucket.

export type MoonPhase = {
  name: string;
  emoji: string;
  illumination: number; // 0–100, percent of disc illuminated
};

const NEW_MOON_REF_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
const SYNODIC_MONTH_MS = 29.530588853 * 86400 * 1000;

export function moonPhase(date: Date = new Date()): MoonPhase {
  const elapsed = date.getTime() - NEW_MOON_REF_MS;
  const cycles = elapsed / SYNODIC_MONTH_MS;
  // Position within the current cycle, normalized to [0, 1).
  const phase = ((cycles % 1) + 1) % 1;

  // Eight phase buckets, each spanning 1/8 of the cycle. The sequence
  // wraps around so the very-late and very-early phase indices both
  // map to "New Moon".
  let name: string;
  let emoji: string;
  if (phase < 0.0625) {
    name = 'New Moon';
    emoji = '🌑';
  } else if (phase < 0.1875) {
    name = 'Waxing Crescent';
    emoji = '🌒';
  } else if (phase < 0.3125) {
    name = 'First Quarter';
    emoji = '🌓';
  } else if (phase < 0.4375) {
    name = 'Waxing Gibbous';
    emoji = '🌔';
  } else if (phase < 0.5625) {
    name = 'Full Moon';
    emoji = '🌕';
  } else if (phase < 0.6875) {
    name = 'Waning Gibbous';
    emoji = '🌖';
  } else if (phase < 0.8125) {
    name = 'Last Quarter';
    emoji = '🌗';
  } else if (phase < 0.9375) {
    name = 'Waning Crescent';
    emoji = '🌘';
  } else {
    name = 'New Moon';
    emoji = '🌑';
  }

  // Illumination follows a cosine of the cycle position: 0 at new moon,
  // 1 at full moon, 0 again at the next new moon.
  const illumination = Math.round(((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100);
  return { name, emoji, illumination };
}
