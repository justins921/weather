import type { ReactNode } from 'react';

type Props = {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  // Renders below the sub line. Supply your own divider/structure.
  footer?: ReactNode;
};

export default function MetricCard({ label, value, sub, footer }: Props) {
  return (
    <div className="card p-5 text-center">
      <div className="stat-label">{label}</div>
      <div className="stat-value mt-1.5">{value}</div>
      {sub && <div className="stat-sub mt-0.5">{sub}</div>}
      {footer}
    </div>
  );
}
