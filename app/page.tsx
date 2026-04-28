'use client';

import { useEffect, useState } from 'react';
import LocationCard from '@/components/LocationCard';
import LocationSearch from '@/components/LocationSearch';
import {
  addLocation,
  loadLocations,
  removeLocation as removeLoc,
} from '@/lib/locations';
import type { Location } from '@/lib/types';

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());

  useEffect(() => {
    setLocations(loadLocations());
  }, []);

  function handleAdd(loc: Omit<Location, 'id'>) {
    setLocations(addLocation(loc));
    setUpdatedAt(new Date());
  }

  function handleRemove(id: string) {
    setLocations(removeLoc(id));
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold">Locations</h1>
      <div className="mt-4">
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
