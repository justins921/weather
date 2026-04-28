import type { ReactNode } from 'react';

type Props = {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
};

export default function MetricCard({ label, value, sub }: Props) {
  return (
    <div className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub && (
        <div className="mt-1 text-xs text-fg-light/60 dark:text-fg-dark/60">{sub}</div>
      )}
    </div>
  );
}
