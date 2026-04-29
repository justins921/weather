export type Location = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  isCurrent?: boolean;
};

export type CurrentBlock = {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  precipitation: number;
  weather_code: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
  dew_point_2m: number;
  cloud_cover: number;
};

export type HourlyBlock = {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  relative_humidity_2m: number[];
  dew_point_2m: number[];
  precipitation_probability: number[];
  precipitation: number[];
  weather_code: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  wind_gusts_10m: number[];
  cloud_cover: number[];
  uv_index: number[];
};

export type DailyBlock = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  precipitation_probability_max: number[];
  precipitation_sum: number[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max: number[];
  wind_direction_10m_dominant: number[];
  sunrise: string[];
  sunset: string[];
  uv_index_max: number[];
};

export type MinutelyBlock = {
  time: string[];
  precipitation: number[];
  precipitation_probability: number[];
};

export type Forecast = {
  latitude: number;
  longitude: number;
  timezone: string;
  current: CurrentBlock;
  hourly: HourlyBlock;
  daily: DailyBlock;
  minutely_15?: MinutelyBlock;
};

export type GeocodeResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
};

export type RainViewerFrame = {
  time: number;
  path: string;
};

export type RainViewerData = {
  version: string;
  generated: number;
  host: string;
  radar: {
    past: RainViewerFrame[];
    nowcast: RainViewerFrame[];
  };
  satellite: {
    infrared: RainViewerFrame[];
  };
};
