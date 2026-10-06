// Shared inline SVG icon set — Lucide/Feather style, stroke-based,
// 24x24 viewBox, currentColor. Replaces emoji UI icons throughout the app.
// Weather condition emojis from lib/weatherCodes.ts are NOT included here
// (those are condition indicators, left as-is).

import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, ...props }: P, children: React.ReactNode) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const MapPinIcon = (p: P) =>
  base(p, <>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </>);

export const BarChartIcon = (p: P) =>
  base(p, <>
    <path d="M3 3v18h18" />
    <path d="M18 17V9" />
    <path d="M13 17V5" />
    <path d="M8 17v-3" />
  </>);

export const RadarIcon = (p: P) =>
  base(p, <>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <path d="M12 12 18.5 5.5" />
  </>);

export const SettingsIcon = (p: P) =>
  base(p, <>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </>);

export const DropletIcon = (p: P) =>
  base(p, <>
    <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
  </>);

export const WindIcon = (p: P) =>
  base(p, <>
    <path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2" />
    <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
    <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
  </>);

export const ThermometerIcon = (p: P) =>
  base(p, <>
    <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
  </>);

export const SunIcon = (p: P) =>
  base(p, <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </>);

export const CloudIcon = (p: P) =>
  base(p, <>
    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
  </>);

export const CloudRainIcon = (p: P) =>
  base(p, <>
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M16 14v6" />
    <path d="M8 14v6" />
    <path d="M12 16v6" />
  </>);

export const CloudSunIcon = (p: P) =>
  base(p, <>
    <path d="M12 2v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="M20 12h2" />
    <path d="m19.07 4.93-1.41 1.41" />
    <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" />
    <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />
  </>);

export const EyeIcon = (p: P) =>
  base(p, <>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>);

export const GaugeIcon = (p: P) =>
  base(p, <>
    <path d="m12 14 4-4" />
    <path d="M3.34 19a10 10 0 1 1 17.32 0" />
  </>);

export const UmbrellaIcon = (p: P) =>
  base(p, <>
    <path d="M22 12a10.06 10.06 0 0 0-20 0Z" />
    <path d="M12 12v8a2 2 0 0 0 4 0" />
    <path d="M12 2v1" />
  </>);

export const SnowflakeIcon = (p: P) =>
  base(p, <>
    <line x1="2" x2="22" y1="12" y2="12" />
    <line x1="12" x2="12" y1="2" y2="22" />
    <path d="m20 16-4-4 4-4" />
    <path d="m4 8 4 4-4 4" />
    <path d="m16 4-4 4-4-4" />
    <path d="m8 20 4-4 4 4" />
  </>);

export const CloudFogIcon = (p: P) =>
  base(p, <>
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M16 17H7" />
    <path d="M17 21H9" />
  </>);

export const NavigationIcon = (p: P) =>
  base(p, <>
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </>);

export const ClockIcon = (p: P) =>
  base(p, <>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </>);

export const FlagIcon = (p: P) =>
  base(p, <>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" x2="4" y1="22" y2="15" />
  </>);

export const TargetIcon = (p: P) =>
  base(p, <>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </>);

export const RefreshCwIcon = (p: P) =>
  base(p, <>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </>);

export const LayersIcon = (p: P) =>
  base(p, <>
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </>);

export const ChevronDownIcon = (p: P) =>
  base(p, <>
    <path d="m6 9 6 6 6-6" />
  </>);

export const SearchIcon = (p: P) =>
  base(p, <>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </>);

export const XIcon = (p: P) =>
  base(p, <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>);

export const CheckIcon = (p: P) =>
  base(p, <>
    <path d="M20 6 9 17l-5-5" />
  </>);

export const FlameIcon = (p: P) =>
  base(p, <>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </>);

export const AlertTriangleIcon = (p: P) =>
  base(p, <>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </>);

export const ZapIcon = (p: P) =>
  base(p, <>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </>);

export const WavesIcon = (p: P) =>
  base(p, <>
    <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
  </>);

export const TornadoIcon = (p: P) =>
  base(p, <>
    <path d="M3 4h18" />
    <path d="M5 8h14" />
    <path d="M7 12h10" />
    <path d="M9 16h6" />
    <path d="M11 20h2" />
  </>);

export const SproutIcon = (p: P) =>
  base(p, <>
    <path d="M7 20h10" />
    <path d="M10 20c5.5-2.5.8-6.4 3-10" />
    <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
    <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-3.2.3-4.4 1-4.9 2z" />
  </>);

// --- Clothing icons (simple stroke shapes for the What-to-Wear chips) ---

export const ShirtIcon = (p: P) =>
  base(p, <>
    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
  </>);

export const PantsIcon = (p: P) =>
  base(p, <>
    <path d="M8 3h8l1 18h-3l-1-9h-2l-1 9H7L8 3Z" />
    <path d="M8 7h8" />
  </>);

export const CapIcon = (p: P) =>
  base(p, <>
    <path d="M4 16a8 8 0 0 1 6-7.7V6a2 2 0 0 1 4 0v2.3A8 8 0 0 1 20 16" />
    <path d="M2 16h20" />
    <path d="M20 16h2" />
  </>);

export const GlassesIcon = (p: P) =>
  base(p, <>
    <circle cx="6" cy="15" r="4" />
    <circle cx="18" cy="15" r="4" />
    <path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2" />
    <path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2" />
    <path d="M21.5 13 19 7c-.7-1.3-1.5-2-3-2" />
  </>);

export const GloveIcon = (p: P) =>
  base(p, <>
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    <path d="M7 11a2 2 0 0 0-2 2v1a7 7 0 0 0 7 7h1a7 7 0 0 0 7-7v-2a2 2 0 0 0-3.5-1.3L15 12" />
    <path d="M7 11V7" />
  </>);

export const SunscreenIcon = (p: P) =>
  base(p, <>
    <rect x="9" y="9" width="6" height="11" rx="1.5" />
    <path d="M10 9V7h4v2" />
    <path d="M10 5h4" />
    <path d="M12 13v3" />
  </>);

export const TowelIcon = (p: P) =>
  base(p, <>
    <rect x="5" y="7" width="14" height="11" rx="2" />
    <path d="M5 11h14" />
    <path d="M9 7v4" />
  </>);

export const JacketIcon = (p: P) =>
  base(p, <>
    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h3V10h2v12h3a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    <path d="M12 10v12" />
  </>);

// --- Moon phase (filled, computed from 0..1 phase; 0 = new, 0.5 = full) ---

export function MoonPhaseIcon({ phase, size = 24 }: { phase: number; size?: number }) {
  const cx = 12, cy = 12, r = 7;
  const p = ((phase % 1) + 1) % 1;
  const cos = Math.cos(p * 2 * Math.PI);
  const rx = Math.max(0.15, Math.abs(cos) * r);
  const waxing = p < 0.5;
  const crescent = cos > 0;
  const outerSweep = waxing ? 1 : 0;
  const termSweep = waxing ? (crescent ? 0 : 1) : (crescent ? 1 : 0);
  const d = `M ${cx} ${cy - r} A ${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r} A ${rx.toFixed(2)} ${r} 0 0 ${termSweep} ${cx} ${cy - r} Z`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={1.5} opacity={0.45} />
      <path d={d} fill="currentColor" />
    </svg>
  );
}

// --- String-key registry for lib-driven icons (alerts, wear advice) ---

export type IconKey =
  | 'map-pin' | 'bar-chart' | 'radar' | 'settings'
  | 'droplet' | 'droplets' | 'wind' | 'thermometer' | 'thermometer-sun'
  | 'sun' | 'cloud' | 'cloud-rain' | 'cloud-sun' | 'cloud-fog'
  | 'eye' | 'gauge' | 'umbrella' | 'snowflake'
  | 'navigation' | 'clock' | 'flag' | 'target'
  | 'refresh-cw' | 'layers' | 'chevron-down' | 'search' | 'x' | 'check'
  | 'flame' | 'alert-triangle' | 'zap' | 'waves' | 'tornado' | 'sprout'
  | 'shirt' | 'pants' | 'cap' | 'glasses' | 'jacket' | 'glove'
  | 'sunscreen' | 'towel';

const REGISTRY: Record<IconKey, (p: P) => React.ReactNode> = {
  'map-pin': MapPinIcon,
  'bar-chart': BarChartIcon,
  radar: RadarIcon,
  settings: SettingsIcon,
  droplet: DropletIcon,
  droplets: DropletIcon,
  wind: WindIcon,
  thermometer: ThermometerIcon,
  'thermometer-sun': ThermometerIcon,
  sun: SunIcon,
  cloud: CloudIcon,
  'cloud-rain': CloudRainIcon,
  'cloud-sun': CloudSunIcon,
  'cloud-fog': CloudFogIcon,
  eye: EyeIcon,
  gauge: GaugeIcon,
  umbrella: UmbrellaIcon,
  snowflake: SnowflakeIcon,
  navigation: NavigationIcon,
  clock: ClockIcon,
  flag: FlagIcon,
  target: TargetIcon,
  'refresh-cw': RefreshCwIcon,
  layers: LayersIcon,
  'chevron-down': ChevronDownIcon,
  search: SearchIcon,
  x: XIcon,
  check: CheckIcon,
  flame: FlameIcon,
  'alert-triangle': AlertTriangleIcon,
  zap: ZapIcon,
  waves: WavesIcon,
  tornado: TornadoIcon,
  sprout: SproutIcon,
  shirt: ShirtIcon,
  pants: PantsIcon,
  cap: CapIcon,
  glasses: GlassesIcon,
  jacket: JacketIcon,
  glove: GloveIcon,
  sunscreen: SunscreenIcon,
  towel: TowelIcon,
};

export function IconFor({ icon, size = 24, className }: { icon: IconKey; size?: number; className?: string }) {
  const Cmp = REGISTRY[icon] ?? AlertTriangleIcon;
  return <Cmp size={size} className={className} />;
}
