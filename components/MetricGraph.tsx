'use client';

import { useMemo } from 'react';

export type GraphMetric = 'temp' | 'feels' | 'wind' | 'precip' | 'play';

type Props = {
  values: number[];
  hourLabels: string[];
  formatValue: (v: number) => string;
  playabilityMode?: boolean;
  width?: number;
  height?: number;
};

// Smooth multi-metric curve with value labels and hour labels.
// Based on the same Catmull-Rom smoothing as TempCurve, but renders
// labeled data points at intervals and an hour axis below.
// Purely presentational — no interactivity, no data fetching.
export default function MetricGraph({
  values,
  hourLabels,
  formatValue,
  playabilityMode = false,
  width = 720,
  height = 200,
}: Props) {
  const { line, area } = useMemo(() => {
    if (values.length < 2) return { line: '', area: '' };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padX = 28;
    const padTop = 30;
    const padBottom = 8;
    const chartH = height - padTop - padBottom;
    const stepX = (width - padX * 2) / (values.length - 1);
    const y = (t: number) => padTop + (1 - (t - min) / range) * chartH;
    const pts = values.map((t, i) => [padX + i * stepX, y(t)] as const);

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
    const areaPath = `${d} L ${pts[pts.length - 1][0]},${height - padBottom} L ${pts[0][0]},${height - padBottom} Z`;
    return { line: d, area: areaPath };
  }, [values, width, height]);

  const gid = useMemo(() => `mg-${Math.random().toString(36).slice(2, 8)}`, []);

  // Point coordinates for labels (recomputed cheaply from the same math).
  const points = useMemo(() => {
    if (values.length < 2) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padX = 28;
    const padTop = 30;
    const padBottom = 8;
    const chartH = height - padTop - padBottom;
    const stepX = (width - padX * 2) / (values.length - 1);
    return values.map((t, i) => ({
      x: padX + i * stepX,
      y: padTop + (1 - (t - min) / range) * chartH,
      v: t,
    }));
  }, [values, width, height]);

  // Label every 4th point (roughly every 4 hours for 24h data).
  const labelledIdx = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < values.length; i += 4) out.push(i);
    return out;
  }, [values.length]);

  const stroke = playabilityMode ? '#22c55e' : 'var(--temp-curve)';

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          {playabilityMode ? (
            <linearGradient id={`${gid}-play`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="25%" stopColor="#84cc16" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="75%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          ) : (
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--temp-curve)" stopOpacity="var(--temp-curve-fill-opacity)" />
              <stop offset="100%" stopColor="var(--temp-curve)" stopOpacity="0.02" />
            </linearGradient>
          )}
        </defs>
        <path d={area} fill={playabilityMode ? `url(#${gid}-play)` : `url(#${gid})`} fillOpacity={playabilityMode ? 0.35 : 1} />
        <path
          d={line}
          fill="none"
          stroke={stroke}
          strokeWidth="2.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {labelledIdx.map((i) => {
          const p = points[i];
          if (!p) return null;
          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={3.5}
                fill={playabilityMode ? stroke : 'var(--temp-curve)'}
                stroke="white"
                strokeWidth={1.5}
              />
              <text
                x={p.x}
                y={p.y - 10}
                className="fill-accent-light dark:fill-accent-dark"
                fontSize="13"
                textAnchor="middle"
                fontWeight="600"
              >
                {formatValue(p.v)}
              </text>
            </g>
          );
        })}
      </svg>
      {/* Hour axis */}
      <div className="mt-1 flex justify-between px-1">
        {labelledIdx.map((i) => (
          <span
            key={i}
            className="text-xs text-fg-light/50 dark:text-fg-dark/50"
          >
            {hourLabels[i] ?? ''}
          </span>
        ))}
      </div>
    </div>
  );
}
