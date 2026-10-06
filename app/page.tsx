'use client';

import { useEffect, useRef, useState } from 'react';
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());
  const pickerRef = useRef<HTMLDivElement>(null);

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

  // Close picker on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

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
    setPickerOpen(false);
  }

  const selected = locations.find((l) => l.id === selectedId) ?? locations[0] ?? null;
  const hasCurrent = locations.some((l) => l.isCurrent);

  return (
    <div className="px-5 pb-8 pt-6">
      {/* Location picker */}
      <div className="relative flex justify-center" ref={pickerRef}>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="flex items-center gap-1.5 text-lg text-fg-light/80 dark:text-fg-dark/80"
          aria-haspopup="listbox"
          aria-expanded={pickerOpen}
        >
          <span className="text-base" aria-hidden>📍</span>
          <span className="font-medium tracking-tight">{selected?.name ?? 'Select location'}</span>
          <span
            className="text-sm text-fg-light/50 transition-transform dark:text-fg-dark/50"
            style={{ transform: pickerOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
            aria-hidden
          >
            ⌄
          </span>
        </button>
        {pickerOpen && (
          <div
            role="listbox"
            className="card absolute top-full z-20 mt-2 w-64 overflow-hidden py-1"
          >
            {locations.map((l) => (
              <div
                key={l.id}
                role="option"
                aria-selected={l.id === selected?.id}
                className={`flex items-center justify-between px-4 py-2.5 text-[15px] ${
                  l.id === selected?.id
                    ? 'font-semibold text-accent-light dark:text-accent-dark'
                    : ''
                }`}
              >
                <button
                  onClick={() => handleSelect(l.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {l.isCurrent && <span aria-hidden>📍</span>}
                  <span className="truncate">{l.name}</span>
                </button>
                {!l.isCurrent && (
                  <button
                    onClick={() => handleRemove(l.id)}
                    className="ml-2 px-1 text-fg-light/40 hover:text-fg-light/80 dark:text-fg-dark/40 dark:hover:text-fg-dark/80"
                    aria-label={`Remove ${l.name}`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <div className="border-t border-black/[0.06] dark:border-white/[0.08]">
              <button
                onClick={() => {
                  setPickerOpen(false);
                  setSearchOpen(true);
                }}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-[15px] text-accent-light dark:text-accent-dark"
              >
                <span aria-hidden>+</span> Add location
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Search / add location */}
      {searchOpen && (
        <div className="mt-4">
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
        <div className="mt-3">
          <CurrentLocationButton
            hasCurrent={hasCurrent}
            onSet={(next) => {
              setLocations(next);
              setUpdatedAt(new Date());
            }}
          />
        </div>
      )}

      {/* Selected location hero */}
      {selected ? (
        <div className="mt-4">
          <LocationHero key={selected.id} loc={selected} />
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
