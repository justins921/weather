'use client';

import type { Location } from './types';

const LOCATIONS_KEY = 'weather.locations';
const SELECTED_KEY = 'weather.selectedLocationId';

export const DEFAULT_LOCATIONS: Location[] = [
  { id: 'lake-breeze', name: 'Lake Breeze', lat: 44.0847, lon: -88.5426 },
  { id: 'westhaven', name: 'Westhaven', lat: 44.0289, lon: -88.5879 },
  { id: 'home', name: 'Home', lat: 44.0247, lon: -88.5426 },
];

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function sortCurrentFirst(locations: Location[]): Location[] {
  // The "current location" entry always pins to the top of the list,
  // regardless of insertion order.
  return [...locations].sort(
    (a, b) => Number(b.isCurrent ?? false) - Number(a.isCurrent ?? false),
  );
}

export function loadLocations(): Location[] {
  if (!isBrowser()) return DEFAULT_LOCATIONS;
  try {
    const raw = window.localStorage.getItem(LOCATIONS_KEY);
    if (!raw) {
      window.localStorage.setItem(LOCATIONS_KEY, JSON.stringify(DEFAULT_LOCATIONS));
      return DEFAULT_LOCATIONS;
    }
    const parsed = JSON.parse(raw) as Location[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LOCATIONS;
    return sortCurrentFirst(parsed);
  } catch {
    return DEFAULT_LOCATIONS;
  }
}

export function saveLocations(locations: Location[]): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(LOCATIONS_KEY, JSON.stringify(sortCurrentFirst(locations)));
}

export const CURRENT_LOCATION_ID = 'current';

export function setCurrentLocation(coords: {
  lat: number;
  lon: number;
  name?: string | null;
}): Location[] {
  const existing = loadLocations().filter((l) => l.id !== CURRENT_LOCATION_ID);
  const current: Location = {
    id: CURRENT_LOCATION_ID,
    name: coords.name && coords.name.trim() ? coords.name.trim() : 'Current Location',
    lat: coords.lat,
    lon: coords.lon,
    isCurrent: true,
  };
  const next = [current, ...existing];
  saveLocations(next);
  return next;
}

export function hasCurrentLocation(): boolean {
  return loadLocations().some((l) => l.isCurrent);
}

// Convert a meters-above-sea-level value (as Open-Meteo returns it) into feet
// and write it back onto the matching location. Idempotent — if the elevation
// is already set, no-op.
export function setLocationElevation(id: string, meters: number): Location[] {
  const locations = loadLocations();
  const existing = locations.find((l) => l.id === id);
  if (!existing) return locations;
  const feet = Math.round(meters * 3.28084);
  if (existing.elevation_ft === feet) return locations;
  const next = locations.map((l) => (l.id === id ? { ...l, elevation_ft: feet } : l));
  saveLocations(next);
  return next;
}

export function addLocation(loc: Omit<Location, 'id'> & { id?: string }): Location[] {
  const locations = loadLocations();
  const id = loc.id ?? slugify(loc.name) + '-' + Math.random().toString(36).slice(2, 6);
  const next = [...locations, { ...loc, id }];
  saveLocations(next);
  return next;
}

export function removeLocation(id: string): Location[] {
  const next = loadLocations().filter((l) => l.id !== id);
  saveLocations(next);
  if (getSelectedId() === id) {
    setSelectedId(next[0]?.id ?? null);
  }
  return next;
}

export function getSelectedId(): string | null {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(SELECTED_KEY);
}

export function setSelectedId(id: string | null): void {
  if (!isBrowser()) return;
  if (id === null) window.localStorage.removeItem(SELECTED_KEY);
  else window.localStorage.setItem(SELECTED_KEY, id);
}

export function getSelectedLocation(): Location | null {
  const locations = loadLocations();
  const id = getSelectedId();
  return locations.find((l) => l.id === id) ?? locations[0] ?? null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
