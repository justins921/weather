'use client';

import { useEffect, useRef, useState } from 'react';
import { geocode } from '@/lib/api';
import { searchGolfCourse, type GolfCourseResult } from '@/lib/golfCourseSearch';
import type { GeocodeResult, Location } from '@/lib/types';

type Props = {
  onAdd: (loc: Omit<Location, 'id'>) => void;
};

type Mode = 'city' | 'course';

export default function LocationSearch({ onAdd }: Props) {
  const [mode, setMode] = useState<Mode>('city');
  const [q, setQ] = useState('');
  const [cityResults, setCityResults] = useState<GeocodeResult[]>([]);
  const [courseResults, setCourseResults] = useState<GolfCourseResult[]>([]);
  const [searchedCourseQuery, setSearchedCourseQuery] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [showCoords, setShowCoords] = useState(false);
  const [coordName, setCoordName] = useState('');
  const [coordLat, setCoordLat] = useState('');
  const [coordLon, setCoordLon] = useState('');
  const [coordError, setCoordError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // City mode: 300ms debounced auto-search.
  // Course mode: NO auto-search (Nominatim AUP forbids it). User must
  // Enter or blur.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (mode !== 'city') {
      setCityResults([]);
      return;
    }
    if (!q.trim()) {
      setCityResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      geocode(q).then(setCityResults).catch(() => setCityResults([]));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, mode]);

  function pickCity(r: GeocodeResult) {
    onAdd({
      name: r.name + (r.admin1 ? `, ${r.admin1}` : ''),
      lat: r.latitude,
      lon: r.longitude,
    });
    resetSearch();
  }

  function pickCourse(r: GolfCourseResult) {
    onAdd({ name: r.name, lat: r.lat, lon: r.lon });
    resetSearch();
  }

  function resetSearch() {
    setQ('');
    setCityResults([]);
    setCourseResults([]);
    setSearchedCourseQuery(null);
    setCourseError(null);
  }

  async function runCourseSearch() {
    const trimmed = q.trim();
    if (mode !== 'course' || trimmed.length < 3) return;
    if (searchedCourseQuery === trimmed.toLowerCase()) return; // already searched
    setSearchedCourseQuery(trimmed.toLowerCase());
    setIsSearching(true);
    setCourseError(null);
    const { results, error } = await searchGolfCourse(trimmed);
    setIsSearching(false);
    if (error === 'rate-limited') {
      setCourseError('Course search temporarily unavailable. Try again in a moment.');
      setCourseResults([]);
      return;
    }
    if (error === 'fetch-error') {
      setCourseError('Search failed. Check your connection and try again.');
      setCourseResults([]);
      return;
    }
    setCourseResults(results);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setCityResults([]);
    setCourseResults([]);
    setSearchedCourseQuery(null);
    setCourseError(null);
    setIsSearching(false);
  }

  function submitCoords(e: React.FormEvent) {
    e.preventDefault();
    const lat = parseFloat(coordLat);
    const lon = parseFloat(coordLon);
    const name = coordName.trim();
    if (!name) {
      setCoordError('Name is required.');
      return;
    }
    if (Number.isNaN(lat) || lat < -90 || lat > 90) {
      setCoordError('Latitude must be a number between -90 and 90.');
      return;
    }
    if (Number.isNaN(lon) || lon < -180 || lon > 180) {
      setCoordError('Longitude must be a number between -180 and 180.');
      return;
    }
    setCoordError(null);
    onAdd({ name, lat, lon });
    setCoordName('');
    setCoordLat('');
    setCoordLon('');
    setShowCoords(false);
  }

  function toggleCoords() {
    setShowCoords((s) => {
      const next = !s;
      if (next) {
        // Clear the search results so the dropdown doesn't overlay the form.
        resetSearch();
      } else {
        setCoordName('');
        setCoordLat('');
        setCoordLon('');
        setCoordError(null);
      }
      return next;
    });
  }

  const placeholder =
    mode === 'course' ? 'Course name (press Enter to search)' : 'Search city or address…';

  const showCourseEmpty =
    mode === 'course' &&
    !isSearching &&
    !courseError &&
    searchedCourseQuery !== null &&
    courseResults.length === 0;

  return (
    <div>
      <div className="relative">
        <input
          type="search"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (mode === 'course' && e.key === 'Enter') {
              e.preventDefault();
              runCourseSearch();
            }
          }}
          onBlur={() => {
            if (mode === 'course') runCourseSearch();
          }}
          className="w-full rounded-2xl bg-card-light px-4 py-3 text-base outline-none focus:ring-2 focus:ring-accent-light dark:bg-card-dark dark:focus:ring-accent-dark"
        />
        {!showCoords && cityResults.length > 0 && mode === 'city' && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl bg-card-light shadow-lg dark:bg-card-dark">
            {cityResults.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => pickCity(r)}
                  className="block w-full px-4 py-3 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-2 font-medium">
                    <span aria-hidden>📍</span>
                    <span>{r.name}</span>
                  </div>
                  <div className="ml-6 text-xs text-fg-light/60 dark:text-fg-dark/60">
                    {r.admin1 ? `${r.admin1}, ` : ''}
                    {r.country}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!showCoords && mode === 'course' && (isSearching || courseError || courseResults.length > 0 || showCourseEmpty) && (
          <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl bg-card-light shadow-lg dark:bg-card-dark">
            {isSearching && (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-fg-light/60 dark:text-fg-dark/60">
                <Spinner /> Searching…
              </div>
            )}
            {!isSearching && courseError && (
              <div className="px-4 py-3 text-sm text-red-500">{courseError}</div>
            )}
            {!isSearching && !courseError && courseResults.length > 0 && (
              <ul>
                {courseResults.map((r, i) => (
                  <li key={`${r.name}-${i}`}>
                    <button
                      onClick={() => pickCourse(r)}
                      className="block w-full px-4 py-3 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <span aria-hidden>⛳</span>
                        <span>{r.name}</span>
                      </div>
                      {r.address && (
                        <div className="ml-6 text-xs text-fg-light/60 dark:text-fg-dark/60">
                          {r.type === 'fuzzy' ? 'Possibly: ' : ''}
                          {r.address}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {showCourseEmpty && (
              <div className="px-4 py-3 text-sm">
                <div className="text-fg-light/80 dark:text-fg-dark/80">
                  No course found.
                </div>
                <div className="mt-1 text-xs text-fg-light/60 dark:text-fg-dark/60">
                  Try the city name nearby — we&apos;ll get the weather for that area.
                </div>
                <button
                  type="button"
                  onClick={() => switchMode('city')}
                  className="mt-2 text-xs text-accent-light dark:text-accent-dark"
                >
                  Switch to city search →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => switchMode(mode === 'course' ? 'city' : 'course')}
          className="text-xs text-accent-light dark:text-accent-dark"
        >
          {mode === 'course' ? '📍 Search by city or address' : '⛳ Search by golf course name'}
        </button>
        <button
          type="button"
          onClick={toggleCoords}
          className="text-xs text-accent-light dark:text-accent-dark"
        >
          {showCoords ? 'Cancel' : '+ Add by coordinates'}
        </button>
      </div>

      {showCoords && (
        <form onSubmit={submitCoords} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            placeholder="Name"
            value={coordName}
            onChange={(e) => setCoordName(e.target.value)}
            autoComplete="off"
            required
            className="rounded-xl bg-card-light px-3 py-2 text-sm dark:bg-card-dark"
          />
          <input
            placeholder="Latitude"
            value={coordLat}
            onChange={(e) => setCoordLat(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            required
            className="rounded-xl bg-card-light px-3 py-2 text-sm dark:bg-card-dark"
          />
          <input
            placeholder="Longitude"
            value={coordLon}
            onChange={(e) => setCoordLon(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            required
            className="rounded-xl bg-card-light px-3 py-2 text-sm dark:bg-card-dark"
          />
          {coordError && (
            <div className="col-span-full text-xs text-red-500">{coordError}</div>
          )}
          <button
            type="submit"
            className="col-span-full rounded-xl bg-accent-light py-2 text-sm font-semibold text-black dark:bg-accent-dark"
          >
            Add location
          </button>
        </form>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-fg-light/30 border-t-fg-light/80 dark:border-fg-dark/30 dark:border-t-fg-dark/80"
      aria-hidden
    />
  );
}
