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

// Three modes for the layer toggle:
//   radar  — precipitation only (default)
//   sat    — IR satellite only (cloud cover, see weather coming hours
//            before it shows on radar)
//   both   — satellite as base @40% opacity, radar overlaid on top
type LayerKind = 'radar' | 'sat' | 'both';

const LAYER_CYCLE: LayerKind[] = ['radar', 'sat', 'both'];
const LAYER_LABEL: Record<LayerKind, string> = {
  radar: 'Radar',
  sat: 'Sat',
  both: 'Sat+Radar',
};

export default function RadarMap({ lat, lon, zoom = 8, height = '100%', full = false }: Props) {
  const [rv, setRv] = useState<RainViewerData | null>(null);
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [layer, setLayer] = useState<LayerKind>('radar');
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

  // Time axis: radar in radar/both modes, satellite in sat mode. We scrub
  // along whichever feed drives the active layer's primary visual.
  const frames: RainViewerFrame[] = useMemo(() => {
    if (!rv) return [];
    if (layer === 'sat') return rv.satellite.infrared;
    return [...rv.radar.past, ...rv.radar.nowcast];
  }, [rv, layer]);

  const pastCount = rv ? rv.radar.past.length : 0;

  // Reset frame index when switching layers so we're at the most-recent
  // frame of the new feed, not a stale offset.
  useEffect(() => {
    if (!rv) return;
    if (layer === 'sat') {
      setFrameIdx(Math.max(0, rv.satellite.infrared.length - 1));
    } else {
      setFrameIdx(Math.max(0, rv.radar.past.length - 1));
    }
  }, [layer, rv]);

  useEffect(() => {
    if (!playing || frames.length === 0) return;
    // Slightly snappier than the old 600ms now that tiles are preloaded.
    playRef.current = setInterval(() => {
      setFrameIdx((i) => (i + 1) % frames.length);
    }, 500);
    return () => {
      if (playRef.current) clearInterval(playRef.current);
    };
  }, [playing, frames.length]);

  const currentFrame = frames[frameIdx];
  const isNowcast = (layer === 'radar' || layer === 'both') && frameIdx >= pastCount;

  // The whole point of this component's render strategy: we mount EVERY
  // frame's TileLayer at once and toggle visibility via opacity. The
  // browser caches tiles after the first pass through the loop, so
  // subsequent cycles play smoothly. Mounting/unmounting per frame change
  // (the previous approach) re-fetched tiles every step, which on cellular
  // looked like a stutter at every frame boundary.
  const allRadarFrames = useMemo<RainViewerFrame[]>(
    () => (rv ? [...rv.radar.past, ...rv.radar.nowcast] : []),
    [rv],
  );
  const allSatFrames = useMemo<RainViewerFrame[]>(
    () => (rv ? rv.satellite.infrared : []),
    [rv],
  );

  // Which frame index is "active" depends on the current layer. The scrubber
  // drives radar in radar/both modes and satellite in sat mode.
  const activeRadarIdx = layer === 'sat' ? -1 : frameIdx;

  // In 'both' mode, find the satellite frame closest in time to the active
  // radar frame so the two layers stay roughly in sync as we scrub.
  const activeSatIdx = useMemo(() => {
    if (layer === 'sat') return frameIdx;
    if (layer !== 'both') return -1;
    const radarFrame = allRadarFrames[frameIdx];
    if (!radarFrame || allSatFrames.length === 0) return -1;
    let best = 0;
    let bestDelta = Infinity;
    for (let i = 0; i < allSatFrames.length; i++) {
      const d = Math.abs(allSatFrames[i].time - radarFrame.time);
      if (d < bestDelta) {
        bestDelta = d;
        best = i;
      }
    }
    return best;
  }, [layer, frameIdx, allRadarFrames, allSatFrames]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl" style={{ height }}>
      <MapContainer
        center={[lat, lon]}
        zoom={zoom}
        // RainViewer tiles only exist roughly in the 0–10 range; clamp
        // the map's zoom range so Leaflet never sits at a level where
        // tiles can't be served. Going past 10 would pixel-stretch the
        // last native tile (handled below via maxNativeZoom on the
        // overlay TileLayers).
        minZoom={3}
        maxZoom={12}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
          maxZoom={19}
        />
        {/* Preload all radar frames; only the active one is visible. */}
        {rv &&
          allRadarFrames.map((frame, idx) => (
            <TileLayer
              key={`r-${frame.path}`}
              url={`${rv.host}${frame.path}/256/{z}/{x}/{y}/4/1_1.png`}
              opacity={
                idx === activeRadarIdx ? (layer === 'both' ? 0.85 : 0.7) : 0
              }
              zIndex={idx === activeRadarIdx ? 410 : 400}
              // RainViewer's max native tile zoom is ~10. Past that, we
              // tell Leaflet to scale up the z=10 tile rather than
              // requesting non-existent z=11/12 tiles (which would 404).
              maxNativeZoom={10}
              maxZoom={12}
            />
          ))}
        {/* Preload all satellite frames; only the active one is visible. */}
        {rv &&
          allSatFrames.map((frame, idx) => (
            <TileLayer
              key={`s-${frame.path}`}
              url={`${rv.host}${frame.path}/256/{z}/{x}/{y}/0/0_0.png`}
              opacity={
                idx === activeSatIdx ? (layer === 'both' ? 0.4 : 0.85) : 0
              }
              zIndex={idx === activeSatIdx ? (layer === 'both' ? 405 : 410) : 400}
              maxNativeZoom={10}
              maxZoom={12}
            />
          ))}
        <Marker position={[lat, lon]} icon={pinIcon} />
        <Recenter lat={lat} lon={lon} trigger={centerTick} />
      </MapContainer>

      {full && (
        <>
          <Legend layer={layer} />
          <ControlStack
            onLocate={() => setCenterTick((t) => t + 1)}
            onCycleLayer={() =>
              setLayer((l) => LAYER_CYCLE[(LAYER_CYCLE.indexOf(l) + 1) % LAYER_CYCLE.length])
            }
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

function Legend({ layer }: { layer: LayerKind }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 z-[400] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-medium text-black shadow-md backdrop-blur dark:bg-black/70 dark:text-white">
        {(layer === 'radar' || layer === 'both') && (
          <>
            <div className="flex items-center gap-1.5">
              <span>🌧️</span>
              <span>Light</span>
              <div
                className="h-1.5 w-12 rounded-full"
                style={{
                  background:
                    'linear-gradient(to right, #4ade80, #facc15, #f97316, #ef4444, #a855f7)',
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
          </>
        )}
        {(layer === 'sat' || layer === 'both') && (
          <>
            {layer === 'both' && <div className="h-3 w-px bg-black/20 dark:bg-white/20" />}
            <div className="flex items-center gap-1.5">
              <span>☁️</span>
              <span>Thin</span>
              <div
                className="h-1.5 w-10 rounded-full"
                style={{
                  background: 'linear-gradient(to right, #d1d5db, #6b7280, #ffffff)',
                  border: '1px solid rgba(0,0,0,0.1)',
                }}
              />
              <span>Thick</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ControlStack({
  onLocate,
  onCycleLayer,
  onRefresh,
  layer,
}: {
  onLocate: () => void;
  onCycleLayer: () => void;
  onRefresh: () => void;
  layer: LayerKind;
}) {
  const btn =
    'flex h-11 w-11 items-center justify-center rounded-full bg-white text-lg shadow-md transition hover:bg-white/90 dark:bg-black/80 dark:text-white';
  return (
    <div className="absolute right-3 top-16 z-[400] flex flex-col items-center gap-2">
      <button onClick={onLocate} className={btn} aria-label="Recenter">
        📍
      </button>
      <div className="flex flex-col items-center">
        <button onClick={onCycleLayer} className={btn} aria-label={`Layer: ${LAYER_LABEL[layer]}`}>
          📚
        </button>
        <span className="mt-1 rounded bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-black shadow dark:bg-black/80 dark:text-white">
          {LAYER_LABEL[layer]}
        </span>
      </div>
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
