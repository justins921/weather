'use client';

import type { Location } from './types';

const LOCATIONS_KEY = 'weather.locations';
const SELECTED_KEY = 'weather.selectedLocationId';
const DEFAULTS_VERSION_KEY = 'weather.defaultsVersion';
const EXPANDED_KEY = 'weather.expandedIds';

// Bump when adding new entries to DEFAULT_LOCATIONS. On load, any default
// whose id isn't already in the saved list gets appended once. Removing a
// default by hand still sticks (we only run this once per version bump).
const CURRENT_DEFAULTS_VERSION = 3;

// Ids that used to be in DEFAULT_LOCATIONS but were dropped. On a version
// bump these get filtered out of the user's saved list so old seeds don't
// linger forever.
const REMOVED_DEFAULT_IDS = new Set<string>(['wisconsin-cc']);

export const DEFAULT_LOCATIONS: Location[] = [
  { id: 'lake-breeze', name: 'Lake Breeze', lat: 44.0847, lon: -88.5426 },
  { id: 'westhaven', name: 'Westhaven', lat: 44.0289, lon: -88.5879 },
  { id: 'home', name: 'Home', lat: 44.0247, lon: -88.5426 },
  // Coordinates below come from Open-Meteo's geocoder for the closest
  // recognised place; the forecast grid is ~10km so course-vs-city is
  // effectively the same. Tune via "Add by coordinates" if you want exact.
  { id: 'utica-gc', name: 'Utica Golf Club', lat: 44.0247, lon: -88.5426 },
  { id: 'tpc-danzante-bay', name: 'TPC Danzante Bay', lat: 26.0122, lon: -111.3489 },
  { id: 'tpc-wisconsin', name: 'TPC Wisconsin', lat: 42.9908, lon: -89.5332 },
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
      window.localStorage.setItem(DEFAULTS_VERSION_KEY, String(CURRENT_DEFAULTS_VERSION));
      return DEFAULT_LOCATIONS;
    }
    let parsed = JSON.parse(raw) as Location[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LOCATIONS;
    // One-shot migration: add any new defaults the user hasn't seen yet.
    const savedVersion = parseInt(
      window.localStorage.getItem(DEFAULTS_VERSION_KEY) ?? '0',
      10,
    );
    if (savedVersion < CURRENT_DEFAULTS_VERSION) {
      let mutated = false;
      // Prune any defaults we've since removed.
      const pruned = parsed.filter((l) => !REMOVED_DEFAULT_IDS.has(l.id));
      if (pruned.length !== parsed.length) {
        parsed = pruned;
        mutated = true;
      }
      // Add any new defaults the user hasn't seen yet.
      const existingIds = new Set(parsed.map((l) => l.id));
      const newDefaults = DEFAULT_LOCATIONS.filter((d) => !existingIds.has(d.id));
      if (newDefaults.length > 0) {
        parsed = [...parsed, ...newDefaults];
        mutated = true;
      }
      if (mutated) {
        window.localStorage.setItem(LOCATIONS_KEY, JSON.stringify(sortCurrentFirst(parsed)));
      }
      window.localStorage.setItem(DEFAULTS_VERSION_KEY, String(CURRENT_DEFAULTS_VERSION));
    }
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

// Expand/collapse state. Cards default to collapsed (so the dashboard stays
// scannable). The ids of expanded cards live in localStorage so the choice
// survives reloads.
export function getExpandedIds(): Set<string> {
  if (!isBrowser()) return new Set();
  try {
    const raw = window.localStorage.getItem(EXPANDED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function setExpandedIds(ids: Iterable<string>): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(EXPANDED_KEY, JSON.stringify([...ids]));
}

export function toggleExpanded(id: string): Set<string> {
  const ids = getExpandedIds();
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  setExpandedIds(ids);
  return ids;
}
