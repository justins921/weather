'use client';

import { useEffect, useState } from 'react';
import CourseComparison from '@/components/CourseComparison';
import CurrentLocationButton from '@/components/CurrentLocationButton';
import LocationHero from '@/components/LocationHero';
import LocationSearch from '@/components/LocationSearch';
import { reverseGeocode } from '@/lib/api';
import {
  addLocation,
  getSelectedId,
  loadLocations,
  removeLocation as removeLoc,
  setCurrentLocation,
  setSelectedId,
} from '@/lib/locations';
import type { Location } from '@/lib/types';

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());

  useEffect(() => {
    const initial = loadLocations();
    setLocations(initial);
    const saved = getSelectedId();
    const valid = saved && initial.some((l) => l.id === saved) ? saved : initial[0]?.id ?? null;
    setSelected(valid);
    if (valid) setSelectedId(valid);

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
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
      );
    }
  }, []);

  // Close picker on outside click is handled inside LocationHero.

  function handleAdd(loc: Omit<Location, 'id'>) {
    const next = addLocation(loc);
    setLocations(next);
    const added = next[next.length - 1];
    if (added) {
      setSelected(added.id);
      setSelectedId(added.id);
    }
    setSearchOpen(false);
    setUpdatedAt(new Date());
  }

  function handleRemove(id: string) {
    const next = removeLoc(id);
    setLocations(next);
    if (selectedId === id) {
      const fallback = next[0]?.id ?? null;
      setSelected(fallback);
      setSelectedId(fallback);
    }
  }

  function handleSelect(id: string) {
    setSelected(id);
    setSelectedId(id);
  }

  const selected = locations.find((l) => l.id === selectedId) ?? locations[0] ?? null;
  const hasCurrent = locations.some((l) => l.isCurrent);

  return (
    <div className="px-5 pb-8 pt-6">
      {/* Search / add location */}
      {searchOpen && (
        <div className="mb-4">
          <LocationSearch onAdd={handleAdd} />
          <button
            onClick={() => setSearchOpen(false)}
            className="mt-2 w-full text-center text-sm text-fg-light/50 dark:text-fg-dark/50"
          >
            Cancel
          </button>
        </div>
      )}
      {!searchOpen && (
        <div className="mb-4">
          <CurrentLocationButton
            hasCurrent={hasCurrent}
            onSet={(next) => {
              setLocations(next);
              setUpdatedAt(new Date());
            }}
          />
        </div>
      )}

      {/* Selected location hero (includes the location picker in its header) */}
      {selected ? (
        <div className="mt-2">
          <LocationHero
            key={selected.id}
            loc={selected}
            locations={locations}
            onSelect={handleSelect}
            onRemove={handleRemove}
            onAddRequest={() => setSearchOpen(true)}
          />
        </div>
      ) : (
        <div className="card mt-4 p-6 text-center text-sm text-fg-light/60 dark:text-fg-dark/60">
          No locations yet. Add one to get started.
        </div>
      )}

      {/* Golf course conditions */}
      {locations.length >= 1 && <CourseComparison locations={locations} />}

      <div className="mt-8 text-center text-[11px] text-fg-light/40 dark:text-fg-dark/40">
        Updated {updatedAt.toLocaleTimeString()}
      </div>
    </div>
  );
}
