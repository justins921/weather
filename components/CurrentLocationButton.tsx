'use client';

import { useState } from 'react';
import { reverseGeocode } from '@/lib/api';
import { setCurrentLocation, setSelectedId, CURRENT_LOCATION_ID } from '@/lib/locations';
import type { Location } from '@/lib/types';

type Props = {
  onSet: (locations: Location[]) => void;
  hasCurrent: boolean;
};

export default function CurrentLocationButton({ onSet, hasCurrent }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function request() {
    if (!('geolocation' in navigator)) {
      setError('Location unavailable. Add manually with search instead.');
      return;
    }
    setError(null);
    setPending(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const name = await reverseGeocode(lat, lon);
        const next = setCurrentLocation({ lat, lon, name });
        // Make the new current location the selected one so /forecast uses it.
        setSelectedId(CURRENT_LOCATION_ID);
        onSet(next);
        setPending(false);
      },
      () => {
        setError('Location unavailable. Add manually with search instead.');
        setPending(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={request}
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-card-light py-3 text-sm font-medium hover:bg-black/5 disabled:opacity-60 dark:bg-card-dark dark:hover:bg-white/5"
      >
        <span className="text-base">📍</span>
        {pending
          ? 'Getting your location…'
          : hasCurrent
            ? 'Refresh current location'
            : 'Use my current location'}
      </button>
      {error && <p className="mt-1 px-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
