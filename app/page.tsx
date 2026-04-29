'use client';

import { useEffect, useState } from 'react';
import CurrentLocationButton from '@/components/CurrentLocationButton';
import LocationCard from '@/components/LocationCard';
import LocationSearch from '@/components/LocationSearch';
import { reverseGeocode } from '@/lib/api';
import {
  addLocation,
  loadLocations,
  removeLocation as removeLoc,
  setCurrentLocation,
} from '@/lib/locations';
import type { Location } from '@/lib/types';

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());

  useEffect(() => {
    const initial = loadLocations();
    setLocations(initial);

    // Refresh the current location's coordinates on every app load so weather
    // follows the user as they move. We don't trust cached lat/lon.
    const current = initial.find((l) => l.isCurrent);
    if (current && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const name = await reverseGeocode(lat, lon);
          setLocations(setCurrentLocation({ lat, lon, name }));
          setUpdatedAt(new Date());
        },
        () => {
          // Permission denied or unavailable — keep stale coords; user can disable
          // by removing the card.
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
      );
    }
  }, []);

  function handleAdd(loc: Omit<Location, 'id'>) {
    setLocations(addLocation(loc));
    setUpdatedAt(new Date());
  }

  function handleRemove(id: string) {
    setLocations(removeLoc(id));
  }

  const hasCurrent = locations.some((l) => l.isCurrent);

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold">Locations</h1>
      <div className="mt-4 space-y-2">
        <CurrentLocationButton
          hasCurrent={hasCurrent}
          onSet={(next) => {
            setLocations(next);
            setUpdatedAt(new Date());
          }}
        />
        <LocationSearch onAdd={handleAdd} />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        {locations.map((loc) => (
          <LocationCard key={loc.id} loc={loc} onRemove={handleRemove} />
        ))}
        {locations.length === 0 && (
          <div className="rounded-2xl bg-card-light p-6 text-center text-sm text-fg-light/60 dark:bg-card-dark dark:text-fg-dark/60">
            No locations yet. Search above to add one.
          </div>
        )}
      </div>
      <div className="mt-8 text-center text-[11px] text-fg-light/40 dark:text-fg-dark/40">
        Updated {updatedAt.toLocaleTimeString()}
      </div>
    </div>
  );
}
