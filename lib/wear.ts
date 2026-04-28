// What to wear for the next 12 hours, based on apparent temp range
// plus wind and precip. Output one of the user's preferred combinations:
//   "shorts and a polo", "pants and a polo",
//   "shorts and a light long sleeve", "pants and a light long sleeve"
// extended with optional layers (windbreaker, rain shell, hat, jacket).

export type WearAdvice = {
  base: string; // primary outfit, e.g. "Pants and a light long sleeve"
  extras: string[]; // additional layers/recs
  summary: string; // joined sentence
  emoji: string;
};

type Inputs = {
  feels: number[]; // apparent temp F per hour
  wind: number[]; // mph per hour
  gusts: number[]; // mph per hour
  precipProb: number[]; // % per hour
};

export function wearAdvice(i: Inputs): WearAdvice {
  const minFeels = Math.min(...i.feels);
  const maxFeels = Math.max(...i.feels);
  const peakWind = Math.max(...i.wind);
  const peakGust = Math.max(...i.gusts);
  const peakPrecip = Math.max(...i.precipProb);

  // Bottom: pants if it gets even briefly cool during the window.
  const bottom: 'Shorts' | 'Pants' = minFeels < 60 ? 'Pants' : 'Shorts';

  // Top: polo if warm enough throughout, long sleeve if it gets cool,
  // long sleeve also if windy.
  let top = 'polo';
  if (minFeels < 55) top = 'light long sleeve';
  else if (peakWind >= 14 && minFeels < 65) top = 'light long sleeve';

  const base = `${bottom} and a ${top}`;
  const extras: string[] = [];

  if (minFeels < 45) extras.push('pack a jacket');
  else if (minFeels < 55 && top === 'light long sleeve') extras.push('grab a vest');
  if (peakGust >= 22 && minFeels < 70) extras.push('windbreaker for the gusts');
  if (peakPrecip >= 50) extras.push('rain shell');
  else if (peakPrecip >= 30) extras.push('a hat for showers');
  if (maxFeels >= 85) extras.push('sun hat + sunscreen');

  const summary = extras.length ? `${base} — ${extras.join(', ')}.` : `${base}.`;

  let emoji = '👕';
  if (minFeels < 45) emoji = '🧥';
  else if (top === 'light long sleeve') emoji = '👔';
  if (peakPrecip >= 50) emoji = '🧥';

  return { base, extras, summary, emoji };
}
