'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { getSelectedLocation } from '@/lib/locations';
import type { Location } from '@/lib/types';

const RadarMap = dynamic(() => import('@/components/RadarMap'), { ssr: false });

export default function RadarPage() {
  const [loc, setLoc] = useState<Location | null>(null);

  useEffect(() => {
    setLoc(getSelectedLocation());
  }, []);

  if (!loc) {
    return (
      <div className="px-4 pt-6">
        <h1 className="text-2xl font-bold">Radar</h1>
        <p className="mt-4 text-sm text-fg-light/60 dark:text-fg-dark/60">
          Pick a location first.
        </p>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 top-0 bottom-16 px-2 pt-2">
      <div className="mx-auto h-full max-w-3xl">
        <RadarMap lat={loc.lat} lon={loc.lon} zoom={8} full height="100%" />
      </div>
    </div>
  );
}
