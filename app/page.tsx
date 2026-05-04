'use client';

import { useEffect, useState } from 'react';
import CourseComparison from '@/components/CourseComparison';
import CurrentLocationButton from '@/components/CurrentLocationButton';
import LocationCard from '@/components/LocationCard';
import LocationSearch from '@/components/LocationSearch';
import { reverseGeocode } from '@/lib/api';
import {
  addLocation,
  getExpandedIds,
  loadLocations,
  removeLocation as removeLoc,
  setCurrentLocation,
  setExpandedIds,
  toggleExpanded,
} from '@/lib/locations';
import type { Location } from '@/lib/types';

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());

  useEffect(() => {
    const initial = loadLocations();
    setLocations(initial);
    setExpanded(getExpandedIds());

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

  function handleAdd(loc: Omit<Location, 'id'>) {
    setLocations(addLocation(loc));
    setUpdatedAt(new Date());
  }

  function handleRemove(id: string) {
    setLocations(removeLoc(id));
  }

  function handleToggleExpand(id: string) {
    setExpanded(toggleExpanded(id));
  }

  function expandAll() {
    const next = new Set(locations.map((l) => l.id));
    setExpandedIds(next);
    setExpanded(next);
  }

  function collapseAll() {
    setExpandedIds([]);
    setExpanded(new Set());
  }

  const hasCurrent = locations.some((l) => l.isCurrent);
  const allExpanded = locations.length > 0 && locations.every((l) => expanded.has(l.id));

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
      {locations.length > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-fg-light/60 dark:text-fg-dark/60">
          <span>
            {locations.length} {locations.length === 1 ? 'location' : 'locations'}
          </span>
          <button
            onClick={allExpanded ? collapseAll : expandAll}
            className="text-accent-light dark:text-accent-dark"
          >
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      )}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {locations.map((loc) => (
          <LocationCard
            key={loc.id}
            loc={loc}
            expanded={expanded.has(loc.id)}
            onToggleExpand={handleToggleExpand}
            onRemove={handleRemove}
          />
        ))}
        {locations.length === 0 && (
          <div className="rounded-2xl bg-card-light p-6 text-center text-sm text-fg-light/60 dark:bg-card-dark dark:text-fg-dark/60">
            No locations yet. Search above to add one.
          </div>
        )}
      </div>
      {locations.length >= 2 && (
        <div className="mt-6">
          <CourseComparison locations={locations} />
        </div>
      )}

      <div className="mt-8 text-center text-[11px] text-fg-light/40 dark:text-fg-dark/40">
        Updated {updatedAt.toLocaleTimeString()}
      </div>
    </div>
  );
}
