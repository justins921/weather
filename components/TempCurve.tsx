'use client';

import { useMemo } from 'react';

type Props = {
  temps: number[];
  width?: number;
  height?: number;
};

// Smooth temperature curve rendered as SVG with a subtle area fill.
// Purely presentational — no interactivity, no data fetching.
export default function TempCurve({ temps, width = 720, height = 80 }: Props) {
  const path = useMemo(() => {
    if (temps.length < 2) return { line: '', area: '' };
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const range = max - min || 1;
    const padX = 8;
    const padY = 10;
    const stepX = (width - padX * 2) / (temps.length - 1);
    const y = (t: number) => padY + (1 - (t - min) / range) * (height - padY * 2);
    const pts = temps.map((t, i) => [padX + i * stepX, y(t)] as const);

    // Catmull-Rom to bezier for smoothness
    let d = `M ${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
    }
    const area = `${d} L ${pts[pts.length - 1][0]},${height} L ${pts[0][0]},${height} Z`;
    return { line: d, area };
  }, [temps, width, height]);

  const gid = useMemo(() => `tcg-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-20 w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--temp-curve)" stopOpacity="var(--temp-curve-fill-opacity)" />
          <stop offset="100%" stopColor="var(--temp-curve)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={path.area} fill={`url(#${gid})`} />
      <path
        d={path.line}
        fill="none"
        stroke="var(--temp-curve)"
        strokeWidth="2"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
