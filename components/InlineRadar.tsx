'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';

const RadarMap = dynamic(() => import('./RadarMap'), { ssr: false });

type Props = {
  lat: number;
  lon: number;
};

export default function InlineRadar({ lat, lon }: Props) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-light/50 dark:text-fg-dark/50">
          Radar
        </div>
        <Link href="/radar" className="text-xs text-accent-light dark:text-accent-dark">
          Open full radar →
        </Link>
      </div>
      <div className="h-[200px] overflow-hidden rounded-2xl">
        <RadarMap lat={lat} lon={lon} zoom={8} full={false} />
      </div>
    </section>
  );
}
