'use client';

import { useState } from 'react';
import { alertColor, alertEmoji, type Alert } from '@/lib/alerts';

type Props = {
  alerts: Alert[];
  // Use compact styling on dashboard cards.
  compact?: boolean;
};

// Renders a banner for the most severe active alert, with an expandable
// disclosure for additional alerts. Returns null when there are none.
export default function AlertsBanner({ alerts, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  if (alerts.length === 0) return null;
  const top = alerts[0];
  const others = alerts.slice(1);

  const padding = compact ? 'px-3 py-2' : 'px-4 py-3';
  const titleSize = compact ? 'text-xs' : 'text-sm';

  return (
    <div
      className={`rounded-xl ${padding} text-white`}
      style={{ background: alertColor(top.severity) }}
      role="alert"
    >
      <div className={`flex items-start justify-between gap-2 ${titleSize} font-semibold`}>
        <span className="flex items-start gap-2">
          <span className="leading-tight">{alertEmoji(top.event)}</span>
          <span>{top.event}</span>
        </span>
        {!compact && top.expiresAt && (
          <span className="shrink-0 text-[10px] font-normal opacity-80">
            until {fmtTime(top.endsAt ?? top.expiresAt)}
          </span>
        )}
      </div>
      {!compact && top.headline && top.headline !== top.event && (
        <div className="mt-1 text-xs opacity-90">{top.headline}</div>
      )}
      {others.length > 0 && (
        <button
          onClick={() => setOpen((s) => !s)}
          className="mt-1 text-[11px] underline opacity-90"
        >
          {open ? 'Hide' : `+${others.length} more alert${others.length > 1 ? 's' : ''}`}
        </button>
      )}
      {open && (
        <ul className="mt-2 space-y-1 text-[11px] opacity-90">
          {others.map((a) => (
            <li key={a.id} className="flex gap-2">
              <span>{alertEmoji(a.event)}</span>
              <span>{a.event}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
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
