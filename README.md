# Golf Weather

A personal, mobile-first weather app focused on golf playability.
Single-user, deployed on Vercel.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS (auto light/dark via `prefers-color-scheme`)
- Leaflet + react-leaflet for the radar map
- localStorage for saved locations + selected location + per-card expand state
- No login, no backend database
- Two optional API keys (free, server-side only) — see [Optional keys](#optional-keys)

## Run locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. `npm run build && npm start` for a
production build.

## Optional keys

The app works without any keys — Open-Meteo + NWS + RainViewer + OSM
+ Nominatim cover the bulk of the data. Two integrations are gated
behind free keys; configure them in `.env.local` (and in your Vercel
project's env vars for production):

```bash
# EPA AirNow — real station-measured AQI for US locations.
# Free key: https://docs.airnowapi.org/account/request/
AIRNOW_API_KEY=

# Synoptic Mesonet — closer-than-airport observations from ~50K
# stations including CWOP, RAWS, mesonets, PWS feeds.
# Free public token: https://customer.synopticdata.com/credentials/
SYNOPTIC_TOKEN=

# Optional — overrides the contact email in the Nominatim User-Agent.
# Defaults to the value embedded in app/api/golf-search/route.ts.
NOMINATIM_CONTACT=you@example.com
```

Both keys are read by their respective `app/api/.../route.ts` server
proxies and never reach the client bundle. Without them, the relevant
features silently fall back (AirNow → Open-Meteo modelled AQI;
Synoptic → NWS airport observation only).

The Settings tab in the app shows live status for each integration
(`Active` vs. `Not configured`) by hitting `/api/health`, which
reports booleans only — never the keys themselves.

## Data sources

| Source | Used for | Key? |
| --- | --- | --- |
| [Open-Meteo Forecast](https://open-meteo.com/) | Hourly + daily forecast (GFS seamless), minutely_15 nowcast | No |
| [Open-Meteo Ensemble](https://open-meteo.com/en/docs/ensemble-api) | ICON ensemble for the p10–p90 confidence band on the 24-hour chart | No |
| [Open-Meteo Air Quality](https://open-meteo.com/en/docs/air-quality-api) | Modelled AQI fallback, hourly trajectory, pollen forecast (CAMS Europe) | No |
| [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) | City / address search + reverse-geocoding device GPS | No |
| [NWS api.weather.gov](https://www.weather.gov/documentation/services-web-api) | Active alerts, ASOS/AWOS observations, AFD discussions | No |
| [Nominatim (OSM)](https://nominatim.org/) | Course-name search ("Whistling Straits") via server proxy | No |
| [RainViewer](https://www.rainviewer.com/api.html) | Radar + IR satellite tile frames | No |
| [OpenStreetMap tiles](https://www.openstreetmap.org/) | Base map under the radar overlays | No |
| [EPA AirNow](https://docs.airnowapi.org/) | Real station-measured AQI for US, wildfire smoke detection | **Yes** |
| [Synoptic Mesonet](https://synopticdata.com/) | Closer-than-airport observations (CWOP, RAWS, mesonets) | **Yes** |

External link only (no API call): the **Nearby stations ↗** link
from each card opens [Wunderground's
WunderMap](https://www.wunderground.com/wundermap) centered on the
course, so you can browse the ~250K-station PWS network without an
account.

## Caching

| Key | TTL | Notes |
| --- | --- | --- |
| `fc:lat,lon` | 10 min | single-model forecast |
| `ens:lat,lon` | 30 min | ensemble |
| `aq:lat,lon` | 30 min | AirNow + Open-Meteo AQ |
| `obs:lat,lon` | 5 min | NWS / Mesonet observation |
| `alerts:lat,lon` | 5 min | NWS active alerts |
| `afd:lat,lon` | 30 min | NWS Area Forecast Discussion |
| `station:lat,lon` | session | NWS station ID lookup |

The `lib/clientCache.ts` cache uses sessionStorage so navigating
between tabs doesn't refire the same API calls.

## Tabs

- **Locations** (`/`) — dashboard of saved locations as collapsible cards. City + course-name + by-coordinates search. "Use my current location" shortcut. Each card shows a summary row (weather emoji + feels-like + playability badge); expanding a card adds the Right Now / Coming Up sentence, the Golf card, and the Wear advice. Tap "View detailed forecast →" to go to `/forecast`.
- **Forecast** (`/forecast`) — detail view for the selected location. Layout, top to bottom: alerts banner, Right Now hero (feels-like is the headline number, Actual is the subline), conditional Next-6-hours nowcast (only when precip is expected), Golf card, What to Wear, Wind / Humidity, AQ + UV (half-cards when both exist), Pollen (when Moderate+), Next 24 Hours chart with metric pills (Feels Like / Temp / Wind / Precip / Playability), Next 48 Hours strip, Next 8 Days, Radar preview, Forecast Discussion at the bottom.
- **Radar** (`/radar`) — full-screen radar with frame preloading (smooth animation), 3-mode layer cycle (Radar / Sat / Sat+Radar), play/pause scrubber, locate, refresh. Zoom clamped to RainViewer's data range so you can't land on a "no tile" state.
- **Settings** (`/settings`) — theme, default location, about, and a live-status list of every data source with what it's used for.

## Tunables

- **`lib/playability.ts`** — `CONFIG` block at the top. Penalty thresholds for temp, wind, gust delta, precip, dew point, humidity. Score thresholds and labels in `labelFor`. Hard-zeroed to `After dark` when `is_day === 0`.
- **`lib/wear.ts`** — base outfit by feels-like, then layered modifiers (wind / rain / glove / sun / humidity / pollen). Edit phrasings in place.
- **`lib/narrative.ts`** — `comingUpSentence`, priority-ordered (alerts → precip start → precip end → wind shift → temp swing → cloud change → default).
- **`lib/airDensity.ts`** — `CONFIG` for the "plays +N yds" calculation; sanity-check comment block at the bottom.
- **`lib/airQuality.ts`** — pollen species thresholds.
- **`lib/bestWindow.ts`** — playability-window detection (default threshold 70).
- **`lib/locations.ts`** — `DEFAULT_LOCATIONS`, `CURRENT_DEFAULTS_VERSION` (bump when adding new defaults to migrate existing installs).
- **`lib/weatherCodes.ts`** — WMO code → emoji + label, with day/night variants.

## Project layout

```
app/
  layout.tsx          root shell + bottom nav
  globals.css         tailwind + leaflet
  page.tsx            / (Locations)
  forecast/page.tsx   /forecast
  radar/page.tsx      /radar
  settings/page.tsx   /settings + Data Sources list
  api/
    airnow/route.ts   AirNow proxy (reads AIRNOW_API_KEY)
    pws/route.ts      Synoptic Mesonet proxy (reads SYNOPTIC_TOKEN)
    golf-search/...   Nominatim proxy (User-Agent + 1s throttle)
    health/route.ts   {airnow, synoptic} bool flags for Settings
components/
  AirQualityCard.tsx
  AlertsBanner.tsx
  BarSeries.tsx
  BottomNav.tsx
  CurrentLocationButton.tsx
  DayRow.tsx
  ForecastDiscussion.tsx       NWS AFD
  GolfCard.tsx                 Playability + Club Wind + Air Density
  HourCell.tsx
  HourlyStrip.tsx              Next 48 Hours
  InlineRadar.tsx              200px preview on /forecast
  LocationCard.tsx
  LocationSearch.tsx           city + course + by-coords
  MetricCard.tsx
  MinutelyChart.tsx            conditional Next 6 Hours
  Next24HoursChart.tsx         metric-pill chart with confidence band
  PollenCard.tsx
  PressureTrendLine.tsx
  RadarMap.tsx                 leaflet + RainViewer overlays
  TempBar.tsx
  WeeklyForecast.tsx           Next 8 Days
  WearAdvicePanel.tsx
lib/
  airDensity.ts
  airQuality.ts                AirNow + Open-Meteo combined
  alerts.ts                    NWS alerts
  api.ts                       fetchers
  bestWindow.ts                playability window detection
  clientCache.ts               sessionStorage cache
  clubWind.ts                  mph → club count
  courseConditions.ts          soil moisture → firm/soft/wet
  ensemble.ts                  ICON ensemble percentiles
  format.ts                    fmt helpers + tempColor gradient
  golfCourseSearch.ts          Nominatim wrapper
  locations.ts                 localStorage CRUD + defaults version
  mesonet.ts                   Synoptic client wrapper
  narrative.ts                 rules-based narrative
  nws.ts                       User-Agent + AFD parser
  observations.ts              NWS station observations
  playability.ts               tuneable score
  pressureTrend.ts
  types.ts
  weatherCodes.ts              day/night-aware emoji
  wear.ts                      rules-based outfit advice
```

## What this app deliberately doesn't do

- No login, accounts, or marketing copy.
- No animations beyond hover / radar scrubber / chart pill toggle.
- No native app.
- No general weather features beyond what's listed above.
