// "Will I finish before dark?" math. Civil twilight gives ~25–30 min of
// usable visibility past sunset, so we use sunset + 25 min as the
// practical cutoff to leave a small buffer for putting and walking off.
//
// Open-Meteo's daily.sunset entries are "YYYY-MM-DDTHH:mm" in the
// LOCATION'S local time, no UTC offset. Same convention we use for
// hourly timestamps — parse with a fake Z appended so wall-clock values
// stay verbatim and we don't trip over the browser's timezone.

const POST_SUNSET_USABLE_MINUTES = 25;
const DEFAULT_ROUND_HOURS = 4.5;

export type FinishBuffer = 'comfortable' | 'tight' | 'rushed' | 'impossible';

export type FinishCheck = {
  canFinish: boolean;
  finishLabel: string; // "6:42 PM"
  sunsetLabel: string; // "8:32 PM"
  minutesOfDaylight: number; // negative when finish is past usable end
  buffer: FinishBuffer;
  message: string;
};

export function canFinishRound(
  teeTimeISO: string,
  sunsetISO: string,
  roundHours: number = DEFAULT_ROUND_HOURS,
): FinishCheck {
  const tee = parseLocalAsUtc(teeTimeISO);
  const sunset = parseLocalAsUtc(sunsetISO);
  const finish = new Date(tee.getTime() + roundHours * 3600 * 1000);
  const usableEnd = new Date(sunset.getTime() + POST_SUNSET_USABLE_MINUTES * 60000);
  const minutesOfDaylight = Math.round((usableEnd.getTime() - finish.getTime()) / 60000);

  const finishLabel = fmtClock(finish);
  const sunsetLabel = fmtClock(sunset);

  let buffer: FinishBuffer;
  let message: string;

  if (minutesOfDaylight < -30) {
    buffer = 'impossible';
    const past = Math.abs(minutesOfDaylight + POST_SUNSET_USABLE_MINUTES);
    message = `Won't finish — sunset at ${sunsetLabel} is ${past} min before you'd finish.`;
  } else if (minutesOfDaylight < 0) {
    buffer = 'rushed';
    message = `Cutting it close — finish would be ${Math.abs(minutesOfDaylight)} min after usable daylight.`;
  } else if (minutesOfDaylight < 30) {
    buffer = 'tight';
    message = `Tight finish — about ${minutesOfDaylight} min of daylight to spare.`;
  } else {
    buffer = 'comfortable';
    message = `Plenty of daylight — finish around ${finishLabel}, ${minutesOfDaylight} min before dark.`;
  }

  return {
    canFinish: minutesOfDaylight >= 0,
    finishLabel,
    sunsetLabel,
    minutesOfDaylight,
    buffer,
    message,
  };
}

// True when the user is within the given window of sunset and could
// reasonably ask "can I tee off now?". Used to gate the standalone
// widget on /forecast.
export function isNearSunset(sunsetISO: string, hoursBefore: number = 4): boolean {
  const sunset = parseLocalAsUtc(sunsetISO);
  const nowMs = Date.now();
  // We're in the "near sunset" window if now is within `hoursBefore`
  // before sunset. After sunset doesn't qualify — too late to tee off.
  const minBefore = (sunset.getTime() - nowMs) / 60000;
  return minBefore > 0 && minBefore <= hoursBefore * 60;
}

function parseLocalAsUtc(iso: string): Date {
  return new Date(/Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + 'Z');
}

function fmtClock(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
    .format(d)
    .replace(' ', '');
}
