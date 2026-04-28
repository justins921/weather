// WMO weather code -> emoji + short label

export function weatherEmoji(code: number, cloudCover = 0): string {
  if (code === 0) return '☀️';
  if (code === 1) return cloudCover > 25 ? '🌤️' : '☀️';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 57) return '🌦️';
  if (code >= 61 && code <= 67) return '🌧️';
  if (code >= 71 && code <= 77) return '🌨️';
  if (code >= 80 && code <= 82) return '🌦️';
  if (code === 85 || code === 86) return '🌨️';
  if (code === 95) return '⛈️';
  if (code === 96 || code === 99) return '⛈️';
  return '☁️';
}

export function weatherLabel(code: number, cloudCover = 0): string {
  // Mapped from spec's narrative table.
  if (code === 0) return 'Clear.';
  if (code === 1 || code === 2) return cloudCover < 50 ? 'Mostly sunny.' : 'Partly cloudy.';
  if (code === 3) return 'Mostly cloudy.';
  if (code === 45 || code === 48) return 'Foggy.';
  if (code >= 51 && code <= 55) return 'Drizzling.';
  if (code >= 61 && code <= 65) return 'Raining.';
  if (code >= 71 && code <= 75) return 'Snowing.';
  if (code >= 80 && code <= 82) return 'Rain showers.';
  if (code === 95 || code === 96 || code === 99) return 'Thunderstorms.';
  return 'Cloudy.';
}
