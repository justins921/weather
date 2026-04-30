// Course playing conditions inferred from soil moisture (m³/m³ volumetric
// water content). Field capacity for turfgrass is roughly 0.30–0.40, so we
// bracket around that.

export type CourseConditions = {
  level: 'firm' | 'normal' | 'soft' | 'saturated';
  label: string;
  hint: string;
};

export function courseConditions(soilMoisture: number | undefined): CourseConditions | null {
  if (typeof soilMoisture !== 'number' || Number.isNaN(soilMoisture)) return null;
  if (soilMoisture >= 0.45) {
    return {
      level: 'saturated',
      label: 'Saturated',
      hint: 'Casual water likely, cart paths probable',
    };
  }
  if (soilMoisture >= 0.32) {
    return {
      level: 'soft',
      label: 'Soft and wet',
      hint: 'Ball will plug, expect minimal roll',
    };
  }
  if (soilMoisture < 0.18) {
    return {
      level: 'firm',
      label: 'Firm and fast',
      hint: 'Ball will run, plan for extra roll-out',
    };
  }
  return {
    level: 'normal',
    label: 'Normal',
    hint: 'Standard playing conditions',
  };
}
