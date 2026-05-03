'use client';

import { useEffect, useState } from 'react';
import { cachedFetch } from '@/lib/clientCache';
import { fetchLatestAFD, parseAFD, type AFD, type AFDSection } from '@/lib/nws';

type Props = {
  lat: number;
  lon: number;
};

// Collapsible section showing the most recent NWS Area Forecast Discussion
// for the location's local forecast office. The AFD is real meteorologist
// analysis, updated 2-4x daily — much more nuanced than the model output,
// useful for "is the forecaster confident or not?"
export default function ForecastDiscussion({ lat, lon }: Props) {
  const [afd, setAfd] = useState<AFD | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    cachedFetch(`afd:${lat},${lon}`, 30 * 60 * 1000, () => fetchLatestAFD(lat, lon))
      .then((r) => {
        if (!cancelled) setAfd(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [lat, lon]);

  if (!afd) return null;
  const sections = parseAFD(afd.text);
  if (sections.length === 0) return null;

  return (
    <section className="rounded-2xl bg-card-light p-4 dark:bg-card-dark">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="flex flex-col">
          <span className="text-sm font-semibold">
            💬 What forecasters are saying
          </span>
          <span className="text-[10px] text-fg-light/50 dark:text-fg-dark/50">
            Updated {fmtIssuance(afd.issuanceTime)} · NWS {afd.office}
          </span>
        </span>
        <span className="text-fg-light/50 dark:text-fg-dark/50">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-sm leading-relaxed">
          {sections.map((s) => (
            <Section key={s.heading} section={s} />
          ))}
        </div>
      )}
    </section>
  );
}

function Section({ section }: { section: AFDSection }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/60 dark:text-fg-dark/60">
        {section.heading}
      </div>
      <p className="mt-1 whitespace-pre-line text-[13px] text-fg-light/80 dark:text-fg-dark/80">
        {section.body}
      </p>
    </div>
  );
}

function fmtIssuance(iso: string): string {
  if (!iso) return 'recently';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    weekday: 'short',
  })
    .format(new Date(iso))
    .toLowerCase()
    .replace(' ', '');
}
