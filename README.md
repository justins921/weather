# Golf Weather

A personal, mobile-first weather app focused on golf playability. Single-user,
deployed on Vercel.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS (auto light/dark via `prefers-color-scheme`)
- Leaflet + react-leaflet for the radar map
- localStorage for saved locations + selected location
- No login, no backend, no API keys

## Run locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

```bash
npm run build && npm start
```

## Optional: Personal Weather Station data (Synoptic Mesonet)

For ground-truth current conditions closer than the nearest airport ASOS,
the app can pull from the [Synoptic Data Mesonet
network](https://synopticdata.com/) — ~50K stations including CWOP, RAWS,
mesonets, and PWS feeds. Free for non-commercial use.

1. Sign up at <https://customer.synopticdata.com/credentials/>.
2. Generate a public token.
3. Add it to a local `.env.local` (and to your Vercel environment for
   production):

   ```bash
   SYNOPTIC_TOKEN=<your-token>
   ```

The token is read by `app/api/pws/route.ts` (server-side only — never
ships to the client). When configured, `fetchObservation()` prefers the
nearest reporting Mesonet station and falls back to the NWS airport
station if Mesonet has nothing fresh nearby. With no token, the app
silently uses NWS only.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo at <https://vercel.com/new>.
3. No env vars to set. Default build command (`next build`) works as-is.

## Data sources (free, no keys)

- [Open-Meteo Forecast](https://open-meteo.com/) — weather for each location.
  We call two models per location, `gfs_seamless` and `ecmwf_ifs025`, to power
  the model-agreement panel. Units: °F, mph, in.
- [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) — for
  the search bar. Falls back to a manual lat/lon entry for golf courses the
  geocoder doesn't know.
- [RainViewer](https://www.rainviewer.com/api.html) — radar tile frames + the
  cloud (satellite IR) layer. Past 2h + nowcast.
- [OpenStreetMap](https://www.openstreetmap.org/) — base map tiles.

Caching: `revalidate: 1800` for forecast; `revalidate: 600` for the
minutely_15 nowcast slice; in-tab `sessionStorage` cache via
`lib/clientCache.ts` keeps API calls down when navigating between tabs.

## Tabs

- **Locations** (`/`) — dashboard of all saved locations as cards. Search +
  add-by-coordinates. Tap a card to switch active location and jump to
  Forecast.
- **Forecast** (`/forecast`) — detail view for the active location: hero with
  current conditions + playability badge, "Coming up" 12h timeline, 6h
  15-minute nowcast, 48h hourly strip, inline radar preview, 8-day weekly
  forecast (tap row for hourly playability summary), and GFS vs. ECMWF model
  agreement panel.
- **Radar** (`/radar`) — full-screen radar with floating legend, side
  controls (locate, layer toggle, refresh), and a play/pause scrubber. Frames
  past current time are labeled "Nowcast".
- **Settings** (`/settings`) — placeholder. Theme selector, units (locked to
  imperial), default location, about.

## Tunables

- **`lib/playability.ts`** — `CONFIG` block at the top. Penalty thresholds
  for temp, wind, gust delta, precip, dew point, humidity. Score thresholds
  and labels live in `labelFor`.
- **`lib/narrative.ts`** — rule-by-rule comments for the "Coming up" sentence.
  Edit the strings in place to retune voice. Priority order: precip starting,
  precip ending, wind shift, temp swing, cloud change, default.
- **`lib/weatherCodes.ts`** — WMO weather code → emoji + label.
- **`lib/locations.ts`** — `DEFAULT_LOCATIONS` plus localStorage CRUD.

## Project layout

```
app/
  layout.tsx          root shell + bottom nav
  globals.css         tailwind + leaflet
  page.tsx            / (Locations)
  forecast/page.tsx   /forecast
  radar/page.tsx      /radar
  settings/page.tsx   /settings
components/
  BottomNav.tsx
  LocationCard.tsx    used on Locations
  LocationSearch.tsx  geocoder + coords
  MetricCard.tsx
  TempBar.tsx         vertical bars + horizontal range
  HourCell.tsx        used in 48h strip
  DayRow.tsx          used in weekly forecast
  ComingUpTimeline.tsx
  HourlyStrip.tsx
  MinutelyChart.tsx
  WeeklyForecast.tsx
  ModelAgreement.tsx
  RadarMap.tsx        leaflet + RainViewer overlay
  InlineRadar.tsx     200px preview on /forecast
lib/
  api.ts              fetchers
  clientCache.ts      sessionStorage cache
  format.ts           fmt helpers + temp colour gradient
  locations.ts        localStorage CRUD
  narrative.ts        rules-based copy
  playability.ts      tuneable score
  types.ts
  weatherCodes.ts
```

## What this app deliberately doesn't do

- No login, accounts, or marketing copy.
- No animations beyond hover and the radar scrubber.
- No native app.
- No general weather features beyond what's listed above.
