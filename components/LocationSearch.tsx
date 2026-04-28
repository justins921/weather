'use client';

import { useEffect, useRef, useState } from 'react';
import { geocode } from '@/lib/api';
import type { GeocodeResult, Location } from '@/lib/types';

type Props = {
  onAdd: (loc: Omit<Location, 'id'>) => void;
};

export default function LocationSearch({ onAdd }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [showCoords, setShowCoords] = useState(false);
  const [coordName, setCoordName] = useState('');
  const [coordLat, setCoordLat] = useState('');
  const [coordLon, setCoordLon] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      geocode(q).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  function pick(r: GeocodeResult) {
    onAdd({
      name: r.name + (r.admin1 ? `, ${r.admin1}` : ''),
      lat: r.latitude,
      lon: r.longitude,
    });
    setQ('');
    setResults([]);
  }

  function submitCoords(e: React.FormEvent) {
    e.preventDefault();
    const lat = parseFloat(coordLat);
    const lon = parseFloat(coordLon);
    if (!coordName.trim() || Number.isNaN(lat) || Number.isNaN(lon)) return;
    onAdd({ name: coordName.trim(), lat, lon });
    setCoordName('');
    setCoordLat('');
    setCoordLon('');
    setShowCoords(false);
  }

  return (
    <div className="relative">
      <input
        type="search"
        placeholder="Search city or course…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-2xl bg-card-light px-4 py-3 text-base outline-none focus:ring-2 focus:ring-accent-light dark:bg-card-dark dark:focus:ring-accent-dark"
      />
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl bg-card-light shadow-lg dark:bg-card-dark">
          {results.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => pick(r)}
                className="block w-full px-4 py-3 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-fg-light/60 dark:text-fg-dark/60">
                  {r.admin1 ? `${r.admin1}, ` : ''}
                  {r.country}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setShowCoords((s) => !s)}
        className="mt-2 text-xs text-accent-light dark:text-accent-dark"
      >
        {showCoords ? 'Cancel' : '+ Add by coordinates'}
      </button>
      {showCoords && (
        <form onSubmit={submitCoords} className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            placeholder="Name"
            value={coordName}
            onChange={(e) => setCoordName(e.target.value)}
            className="rounded-xl bg-card-light px-3 py-2 text-sm dark:bg-card-dark"
          />
          <input
            placeholder="Latitude"
            value={coordLat}
            onChange={(e) => setCoordLat(e.target.value)}
            className="rounded-xl bg-card-light px-3 py-2 text-sm dark:bg-card-dark"
          />
          <input
            placeholder="Longitude"
            value={coordLon}
            onChange={(e) => setCoordLon(e.target.value)}
            className="rounded-xl bg-card-light px-3 py-2 text-sm dark:bg-card-dark"
          />
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
