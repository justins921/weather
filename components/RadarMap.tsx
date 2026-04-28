'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchRainViewer } from '@/lib/api';
import type { RainViewerData, RainViewerFrame } from '@/lib/types';

type Props = {
  lat: number;
  lon: number;
  zoom?: number;
  height?: string;
  // Show top legend, side controls, bottom scrubber.
  full?: boolean;
};

// SVG pin to avoid loading leaflet's default marker assets.
const pinIcon = L.divIcon({
  className: '',
  html: `<svg width="24" height="34" viewBox="0 0 24 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0c6.627 0 12 5.373 12 12 0 8-12 22-12 22S0 20 0 12C0 5.373 5.373 0 12 0z" fill="#22c55e"/>
    <circle cx="12" cy="12" r="4" fill="#fff"/>
  </svg>`,
  iconSize: [24, 34],
  iconAnchor: [12, 34],
});

function Recenter({ lat, lon, trigger }: { lat: number; lon: number; trigger: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], map.getZoom());
  }, [lat, lon, trigger, map]);
  return null;
}

type LayerKind = 'rain' | 'clouds';

export default function RadarMap({ lat, lon, zoom = 8, height = '100%', full = false }: Props) {
  const [rv, setRv] = useState<RainViewerData | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [layer, setLayer] = useState<LayerKind>('rain');
  const [centerTick, setCenterTick] = useState(0);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    const data = await fetchRainViewer();
    setRv(data);
    const past = data.radar.past.length;
    setFrameIdx(past - 1); // most recent past frame
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const frames: RainViewerFrame[] = useMemo(() => {
    if (!rv) return [];
    if (layer === 'clouds') return rv.satellite.infrared;
    return [...rv.radar.past, ...rv.radar.nowcast];
  }, [rv, layer]);

  const pastCount = rv ? rv.radar.past.length : 0;

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    playRef.current = setInterval(() => {
      setFrameIdx((i) => (i + 1) % frames.length);
    }, 600);
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [playing, frames.length]);

  const currentFrame = frames[frameIdx];
  const isNowcast = layer === 'rain' && frameIdx >= pastCount;

  const tilePath = (frame: RainViewerFrame) => {
    if (!rv) return '';
    const opts = layer === 'clouds' ? '0/1_0' : '4/1_1'; // color scheme + smooth + snow
    return `${rv.host}${frame.path}/256/{z}/{x}/{y}/${opts}.png`;
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl" style={{ height }}>
      <MapContainer
        center={[lat, lon]}
        zoom={zoom}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />
        {currentFrame && (
          <TileLayer
            key={`${layer}-${currentFrame.path}`}
            url={tilePath(currentFrame)}
            opacity={0.7}
          />
        )}
        <Marker position={[lat, lon]} icon={pinIcon} />
        <Recenter lat={lat} lon={lon} trigger={centerTick} />
      </MapContainer>

      {full && (
        <>
          <Legend />
          <ControlStack
            onLocate={() => setCenterTick((t) => t + 1)}
            onToggleLayer={() => setLayer((l) => (l === 'rain' ? 'clouds' : 'rain'))}
            onRefresh={() => load()}
            layer={layer}
          />
          <Scrubber
            frames={frames}
            frameIdx={frameIdx}
            setFrameIdx={setFrameIdx}
            playing={playing}
            setPlaying={setPlaying}
            isNowcast={isNowcast}
          />
        </>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-[400] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-medium text-black shadow-md backdrop-blur dark:bg-black/70 dark:text-white">
        <div className="flex items-center gap-1.5">
          <span>🌧️</span>
          <span>Light</span>
          <div
            className="h-1.5 w-12 rounded-full"
            style={{
              background: 'linear-gradient(to right, #4ade80, #facc15, #f97316, #ef4444, #a855f7)',
            }}
          />
          <span>Heavy</span>
        </div>
        <div className="h-3 w-px bg-black/20 dark:bg-white/20" />
        <div className="flex items-center gap-1.5">
          <span>❄️</span>
          <span>Light</span>
          <div
            className="h-1.5 w-10 rounded-full"
            style={{ background: 'linear-gradient(to right, #bae6fd, #2563eb)' }}
          />
          <span>Heavy</span>
        </div>
      </div>
    </div>
  );
}

function ControlStack({
  onLocate,
  onToggleLayer,
  onRefresh,
  layer,
}: {
  onLocate: () => void;
  onToggleLayer: () => void;
  onRefresh: () => void;
  layer: LayerKind;
}) {
  const btn =
    'flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg shadow-md transition hover:bg-white/90 dark:bg-black/80 dark:text-white';
  return (
    <div className="absolute right-3 top-16 z-[400] flex flex-col gap-2">
      <button onClick={onLocate} className={btn} aria-label="Recenter">
        📍
      </button>
      <button onClick={onToggleLayer} className={btn} aria-label={`Layer: ${layer}`}>
        {layer === 'rain' ? '🌧️' : '☁️'}
      </button>
      <button onClick={onRefresh} className={btn} aria-label="Refresh">
        🔄
      </button>
    </div>
  );
}

function Scrubber({
  frames,
  frameIdx,
  setFrameIdx,
  playing,
  setPlaying,
  isNowcast,
}: {
  frames: RainViewerFrame[];
  frameIdx: number;
  setFrameIdx: (n: number) => void;
  playing: boolean;
  setPlaying: (b: boolean) => void;
  isNowcast: boolean;
}) {
  const current = frames[frameIdx];
  const label = current
    ? isNowcast
      ? 'Nowcast'
      : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
          .format(new Date(current.time * 1000))
          .toLowerCase()
          .replace(' ', '')
    : '—';

  return (
    <div className="absolute inset-x-3 bottom-3 z-[400] flex items-center gap-3 rounded-full bg-white/85 px-3 py-2 shadow-lg backdrop-blur dark:bg-black/75">
      <button
        onClick={() => setPlaying(!playing)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-light text-black dark:bg-accent-dark"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(0, frames.length - 1)}
        value={frameIdx}
        onChange={(e) => setFrameIdx(parseInt(e.target.value, 10))}
        className="flex-1 accent-green-500"
      />
      <div className="w-16 text-right text-xs font-medium text-black dark:text-white">{label}</div>
    </div>
  );
}
