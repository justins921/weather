'use client';

import { useState } from 'react';
import { alertColor, alertEmoji, type Alert } from '@/lib/alerts';

type Props = {
  alerts: Alert[];
  // Use compact styling on dashboard cards.
  compact?: boolean;
};

// Renders a banner per active alert (most-severe first), each tappable to
// expand the full description text. Returns null when there are none.
export default function AlertsBanner({ alerts, compact = false }: Props) {
  if (alerts.length === 0) return null;
  return (
    <div className="space-y-2">
      {alerts.map((a) => (
        <AlertCard key={a.id || a.event} alert={a} compact={compact} />
      ))}
    </div>
  );
}

function AlertCard({ alert: a, compact }: { alert: Alert; compact: boolean }) {
  const [open, setOpen] = useState(false);
  const padding = compact ? 'px-3 py-2' : 'px-4 py-3';
  const titleSize = compact ? 'text-xs' : 'text-sm';

  const hasDescription = !!a.description.trim();

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (hasDescription) setOpen((s) => !s);
      }}
      className={`block w-full rounded-xl text-left ${padding} text-white ${
        hasDescription ? 'cursor-pointer' : 'cursor-default'
      }`}
      style={{ background: alertColor(a.severity) }}
      aria-expanded={open}
    >
      <div className={`flex items-start justify-between gap-2 ${titleSize} font-semibold`}>
        <span className="flex items-start gap-2">
          <span className="leading-tight">{alertEmoji(a.event)}</span>
          <span>{a.event}</span>
        </span>
        {!compact && a.expiresAt && (
          <span className="shrink-0 text-[10px] font-normal opacity-80">
            until {fmtTime(a.endsAt ?? a.expiresAt)}
          </span>
        )}
      </div>
      {!compact && a.headline && a.headline !== a.event && (
        <div
          className={`mt-1 text-xs opacity-90 ${open ? '' : 'line-clamp-2'}`}
        >
          {a.headline}
        </div>
      )}
      {open && hasDescription && (
        <div className="mt-2 whitespace-pre-line text-[11px] opacity-90">
          {a.description}
        </div>
      )}
      {hasDescription && !compact && (
        <div className="mt-1 text-[10px] opacity-70">
          {open ? 'Tap to collapse' : 'Tap to read'}
        </div>
      )}
    </button>
  );
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
    .format(new Date(iso))
    .toLowerCase()
    .replace(' ', '');
}
