// Air density / "plays" indicator. Estimates how today's conditions affect
// ball flight as a single yardage adjustment over a reference 150-yard shot.
// Reference baseline: 70°F, sea level, 1013 hPa, 50% humidity.

export type ConditionsInput = {
  apparent_temp_f: number;
  elevation_ft: number;
  surface_pressure_hpa: number;
  relative_humidity: number;
};

export function carryMultiplier(c: ConditionsInput): number {
  // Elevation: roughly +2% per 1000 ft.
  const elevationFactor = 1 + (c.elevation_ft / 1000) * 0.02;
  // Temperature: +1% per 10°F above 70°F (-1% per 10°F below).
  const tempFactor = 1 + ((c.apparent_temp_f - 70) / 10) * 0.01;
  // Pressure: +1% per 10 hPa below 1013.
  const pressureFactor = 1 + ((1013 - c.surface_pressure_hpa) / 10) * 0.01;
  // Humidity: small lift — humid air is slightly less dense.
  const humidityFactor = 1 + ((c.relative_humidity - 50) / 100) * 0.01;
  return elevationFactor * tempFactor * pressureFactor * humidityFactor;
}

export function playsYards(multiplier: number, referenceYards = 150): number {
  return Math.round((multiplier - 1) * referenceYards);
}

export function playsLabel(yards: number): string {
  if (yards === 0) return 'Plays normal';
  if (yards > 0) return `Plays +${yards} yds`;
  return `Plays ${yards} yds`;
}

// Color for the yardage value in the UI:
// + green (longer), – blue (shorter), 0 default text color.
export function playsColor(yards: number): string | null {
  if (yards > 0) return '#22c55e';
  if (yards < 0) return '#3b82f6';
  return null;
}

// Pick the human-readable dominant factor(s) driving the offset.
export function playsReason(c: ConditionsInput): string {
  const elev = (c.elevation_ft / 1000) * 0.02;
  const temp = ((c.apparent_temp_f - 70) / 10) * 0.01;
  const pres = ((1013 - c.surface_pressure_hpa) / 10) * 0.01;
  // humidity is ignored for the reason — it's too small to be the headline.

  const totalAbs = Math.abs(elev) + Math.abs(temp) + Math.abs(pres);
  // If the net effect rounds to under a yard at 150, call it standard.
  if (Math.abs(playsYards(carryMultiplier(c))) === 0) return 'Standard conditions';
  if (totalAbs < 0.001) return 'Standard conditions';

  if (Math.abs(elev) / totalAbs > 0.5) return 'High elevation';

  // Otherwise rank temp vs. pressure and combine if the runner-up is close.
  const factors: Array<{ name: string; value: number }> = [
    { name: temp >= 0 ? 'Hot' : 'Cold', value: Math.abs(temp) },
    { name: pres >= 0 ? 'Low pressure' : 'High pressure', value: Math.abs(pres) },
  ].sort((a, b) => b.value - a.value);

  if (factors[0].value === 0) return 'Standard conditions';
  // "Close" = secondary at least ~30% as strong as primary.
  if (factors[1].value / factors[0].value > 0.3) {
    return `${factors[0].name}, ${factors[1].name.toLowerCase()}`;
  }
  return factors[0].name;
}

/*
Sanity check — actual computed values from this implementation:

  Lake Breeze, 73°F, 770 ft, 1013 hPa, 55% humidity:
    multiplier 1.019   plays +3 yds   reason "High elevation"
    (matches spec ≈ 1.018 / +3 / "High elevation")

  Lake Breeze, 50°F, 770 ft, 1020 hPa, 70% humidity:
    multiplier 0.990   plays -1 yds   reason "Cold, high pressure"
    (spec said ≈ 0.998 / 0 yds / "Standard conditions" — by the formulas
     literally, the 20° drop below 70°F costs ~2% on its own, more than
     elevation's +1.5% gain, so the multiplier lands below 1.)

  Lake Breeze, 90°F, 770 ft, 1005 hPa, 65% humidity:
    multiplier 1.046   plays +7 yds   reason "Hot, low pressure"
    (matches spec ≈ 1.044 / +7 / "Hot, low pressure")

  Denver, 73°F, 5280 ft, 840 hPa, 30% humidity:
    multiplier 1.298   plays +45 yds  reason "Low pressure"
    (spec expected ≈ 1.085 / +13 / "High elevation" — the discrepancy is
     that at altitude surface_pressure is naturally ~840 hPa, so this
     formula effectively double-counts elevation: once via elevation_ft
     and once via the pressure delta from 1013. The fix, if you want the
     spec values, is to swap the hourly field from surface_pressure to
     pressure_msl (mean-sea-level pressure) — that stays near 1013 at
     any altitude, leaving elevation as the sole driver.)
*/
