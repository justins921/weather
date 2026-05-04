// Wear advice: rule tree based on a single hour's snapshot.
// Pick a base outfit by apparent temp, then layer modifiers
// (wind, rain, glove logic, sun, humidity, pollen) into the detail.

export type WearInputs = {
  apparent_temp: number;
  wind_speed: number;
  wind_gusts: number;
  precip_probability: number;
  uv_index: number;
  dew_point: number;
  // True when any pollen species is High or Very High in the current hour
  // or within the 24-hour peak window. Caller should derive from
  // pollenSummary() in components/PollenCard.tsx.
  highPollen?: boolean;
};

export type WearAdvice = {
  emoji: string;
  headline: string;
  detail: string;
};

export function wearAdvice(i: WearInputs): WearAdvice {
  const t = i.apparent_temp;

  // Base layers, sized to apparent temp.
  let emoji = '☀️';
  let headline = 'Perfect golf weather.';
  let base = 'Polo and shorts.';

  if (t < 35) {
    emoji = '🥶';
    headline = 'Bundle up.';
    base = 'Thermal base layer, sweater or hoodie, golf pants, beanie, winter gloves between shots.';
  } else if (t < 50) {
    emoji = '🧥';
    headline = 'Layer up.';
    base = 'Long sleeve base layer, quarter-zip or vest, pants, beanie or warm hat.';
  } else if (t < 60) {
    emoji = '🧥';
    headline = 'Cool round.';
    base = 'Long sleeve, light quarter-zip or vest, pants.';
  } else if (t < 67) {
    emoji = '🌤️';
    headline = 'Light layers.';
    base = 'Long sleeve or polo with a light pullover you can shed, pants or joggers.';
  } else if (t < 80) {
    emoji = '☀️';
    headline = 'Perfect golf weather.';
    base = 'Polo and shorts.';
  } else if (t < 88) {
    emoji = '😎';
    headline = 'Warm one.';
    base = 'Lightweight polo, shorts, hat.';
  } else {
    emoji = '🥵';
    headline = 'Hot round.';
    base = 'Lightweight breathable polo, shorts, hat, plenty of water.';
  }

  // Modifiers — appended in this fixed order to keep advice predictable.
  const extras: string[] = [];

  // WIND
  if (i.wind_speed >= 15 && i.apparent_temp < 65) {
    extras.push('Windbreaker for the gusts.');
  }
  if (i.wind_speed >= 20) {
    extras.push("Hat with a chin strap or skip the hat — it's flying off.");
  }

  // RAIN
  if (i.precip_probability >= 50) {
    extras.push("Rain jacket and waterproof shoes — it's coming.");
  } else if (i.precip_probability >= 30) {
    extras.push('Pack rain gear just in case.');
  }

  // GLOVE LOGIC (golf-specific)
  if (i.apparent_temp < 50) {
    extras.push('Winter golf gloves between shots, regular glove for the swing.');
  } else if (i.apparent_temp < 60) {
    extras.push('Hand warmer in your pocket helps.');
  }
  if (i.dew_point > 70 && i.apparent_temp > 75) {
    extras.push('Bring a backup glove — the one you start with will be soaked.');
  }

  // SUN
  if (i.uv_index >= 8) {
    extras.push('Sunscreen and a sun sleeve — UV is brutal today.');
  } else if (i.uv_index >= 6) {
    extras.push('Sunscreen, especially on the back of your neck.');
  }

  // HUMIDITY
  if (i.dew_point >= 70) {
    extras.push("Towel to your bag — it's muggy.");
  }

  // POLLEN
  if (i.highPollen) {
    extras.push('Antihistamine before your round if you have allergies.');
  }

  const detail = [base, ...extras].join(' ');
  return { emoji, headline, detail };
}

/*
Sanity check (computed from this implementation):

T-A: 46°F apparent, 19mph wind, 32mph gusts, 10% precip, UV 4, 42° dew →
  emoji: 🧥
  headline: Layer up.
  detail: "Long sleeve base layer, quarter-zip or vest, pants, beanie or
    warm hat. Windbreaker for the gusts. Winter golf gloves between shots,
    regular glove for the swing."
  Notes: spec example also includes "Hat with a chin strap…" but that
  modifier requires wind_speed >= 20; 19 falls just under, so it's not
  appended. (If you want 19mph to trip the hat rule, lower the threshold
  to >= 19.)

T-B: 73°F apparent, 8mph wind, 12mph gusts, 0% precip, UV 7, 60° dew →
  emoji: ☀️
  headline: Perfect golf weather.
  detail: "Polo and shorts. Sunscreen, especially on the back of your neck."

T-C: 90°F apparent, 4mph wind, 6mph gusts, 0% precip, UV 9, 74° dew →
  emoji: 🥵
  headline: Hot round.
  detail: "Lightweight breathable polo, shorts, hat, plenty of water.
    Bring a backup glove — the one you start with will be soaked.
    Sunscreen and a sun sleeve — UV is brutal today. Towel to your bag —
    it's muggy."
*/
