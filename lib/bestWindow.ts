// Best continuous golf window in a series of hourly playability scores.
// "Best" = longest unbroken run with score >= threshold; tiebreak by
// highest average score. Returns null when nothing meets the bar.

export type ScoreSample = { time: string; score: number };

export type BestWindow = {
  startIdx: number;
  endIdx: number; // inclusive
  startTime: string;
  endTime: string;
  avgScore: number;
  length: number; // hours
};

const DEFAULT_THRESHOLD = 70;

export function findBestWindow(
  hourly: ScoreSample[],
  threshold: number = DEFAULT_THRESHOLD,
): BestWindow | null {
  if (hourly.length === 0) return null;

  let best: BestWindow | null = null;
  let currentStart = -1;

  const close = (start: number, end: number): BestWindow => {
    const slice = hourly.slice(start, end + 1);
    const avg = slice.reduce((s, p) => s + p.score, 0) / slice.length;
    return {
      startIdx: start,
      endIdx: end,
      startTime: hourly[start].time,
      endTime: hourly[end].time,
      avgScore: Math.round(avg),
      length: end - start + 1,
    };
  };

  for (let i = 0; i < hourly.length; i++) {
    const above = hourly[i].score >= threshold;
    if (above && currentStart === -1) {
      currentStart = i;
    } else if (!above && currentStart !== -1) {
      const w = close(currentStart, i - 1);
      if (isBetter(w, best)) best = w;
      currentStart = -1;
    }
  }
  // Window extending to end-of-array.
  if (currentStart !== -1) {
    const w = close(currentStart, hourly.length - 1);
    if (isBetter(w, best)) best = w;
  }

  return best;
}

function isBetter(a: BestWindow, b: BestWindow | null): boolean {
  if (!b) return true;
  if (a.length !== b.length) return a.length > b.length;
  return a.avgScore > b.avgScore;
}

// === Tee-time-aware variant ================================================
//
// findBestWindow above optimises for the *longest* run that clears a
// threshold. For "when should I actually tee off?" we want a window that
// fits a typical 18-hole pace (~4.5 hrs) AND scores well — not just the
// longest contiguous OK stretch. We also want to tiebreak toward
// afternoon since that's when most amateur tee times are.

export type TeeTime = {
  startISO: string;
  endISO: string;
  startLabel: string; // "1:00 PM"
  endLabel: string; // "5:30 PM"
  durationHours: number;
  avgScore: number;
  minScore: number; // worst hour in the window
  worstHourLabel: string; // "4 PM"
  reason: string;
  isPartial: boolean; // true when window < idealRoundHours
};

export type FindBestTeeTimeOptions = {
  idealRoundHours?: number; // default 4.5
  minThreshold?: number; // default 60 ("Playable")
};

// Internal — every continuous span scoring >= threshold (not just the
// longest one). Each window's score statistics are precomputed.
type WindowResult = {
  startIdx: number;
  endIdx: number;
  startISO: string;
  endISO: string;
  lengthHours: number;
  avgScore: number;
  minScore: number;
  minIdx: number; // which hour-index inside hourly is the worst
};

export function findAllWindows(
  hourly: ScoreSample[],
  threshold: number = 60,
): WindowResult[] {
  const out: WindowResult[] = [];
  let currentStart = -1;

  const close = (start: number, end: number): WindowResult => {
    const slice = hourly.slice(start, end + 1);
    const avg = slice.reduce((s, p) => s + p.score, 0) / slice.length;
    let minScore = slice[0].score;
    let minIdx = start;
    for (let k = 0; k < slice.length; k++) {
      if (slice[k].score < minScore) {
        minScore = slice[k].score;
        minIdx = start + k;
      }
    }
    return {
      startIdx: start,
      endIdx: end,
      startISO: hourly[start].time,
      // endISO is the END of the last hour, i.e. one hour after the last
      // sample's start. Round-end semantics matter for the displayed
      // "1pm – 5:30pm" label.
      endISO: hourly[end].time,
      lengthHours: end - start + 1,
      avgScore: avg,
      minScore,
      minIdx,
    };
  };

  for (let i = 0; i < hourly.length; i++) {
    const above = hourly[i].score >= threshold;
    if (above && currentStart === -1) {
      currentStart = i;
    } else if (!above && currentStart !== -1) {
      out.push(close(currentStart, i - 1));
      currentStart = -1;
    }
  }
  if (currentStart !== -1) out.push(close(currentStart, hourly.length - 1));
  return out;
}

export function findBestTeeTime(
  hourly: ScoreSample[],
  options: FindBestTeeTimeOptions = {},
): TeeTime | null {
  const idealHours = options.idealRoundHours ?? 4.5;
  const minThreshold = options.minThreshold ?? 60;

  const windows = findAllWindows(hourly, minThreshold);
  if (windows.length === 0) return null;

  const ranked = windows
    .map((w) => ({ w, score: rankWindow(w, idealHours) }))
    .sort((a, b) => b.score - a.score);

  return formatTeeTime(ranked[0].w, idealHours, hourly);
}

function rankWindow(w: WindowResult, idealHours: number): number {
  // Length fit: window of ideal hours or longer = full bonus, shorter =
  // proportional. Penalise short windows more by squaring the deficit.
  const fit = Math.min(w.lengthHours / idealHours, 1.0);
  const lengthBonus = fit * fit * 20; // up to +20 when fits a full round

  // Afternoon bias — tee times 11am–4pm get a small bump. Use the
  // location-local hour by reading the iso string (no timezone math).
  const startHour = parseInt(w.startISO.slice(11, 13), 10);
  const afternoonBonus = startHour >= 11 && startHour <= 16 ? 3 : 0;

  return w.avgScore + lengthBonus + afternoonBonus;
}

function formatTeeTime(
  w: WindowResult,
  idealHours: number,
  hourly: ScoreSample[],
): TeeTime {
  const isPartial = w.lengthHours < idealHours;
  // Compute end-of-window timestamp = start of last hour + 1 hour.
  const endStart = new Date(parseLocalIso(hourly[w.endIdx].time));
  endStart.setUTCHours(endStart.getUTCHours() + 1);
  const endISO = isoFromUtc(endStart);

  return {
    startISO: w.startISO,
    endISO,
    startLabel: fmtClock(w.startISO),
    endLabel: fmtClock(endISO),
    durationHours: w.lengthHours,
    avgScore: Math.round(w.avgScore),
    minScore: Math.round(w.minScore),
    worstHourLabel: fmtClock(hourly[w.minIdx].time),
    reason: generateReason(w, isPartial),
    isPartial,
  };
}

function generateReason(w: WindowResult, isPartial: boolean): string {
  if (isPartial) {
    return `Only a ${w.lengthHours.toFixed(0)}-hour window — might need to play 9.`;
  }
  if (w.avgScore >= 85) return 'Peak conditions — light wind, comfortable temps.';
  if (w.avgScore >= 75) return 'Strong window — very playable.';
  if (w.avgScore >= 65) return 'Workable window — not perfect, but go.';
  return 'Best available, but expect to grind.';
}

// Parse Open-Meteo's location-local iso string ("YYYY-MM-DDTHH:mm")
// pretending it's already UTC, so wall-clock values stay verbatim.
function parseLocalIso(iso: string): string {
  if (/Z|[+-]\d{2}:\d{2}$/.test(iso)) return iso;
  return iso + 'Z';
}
function isoFromUtc(d: Date): string {
  // Build "YYYY-MM-DDTHH:mm" string that callers downstream can re-parse
  // with the same convention.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function fmtClock(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
    .format(new Date(parseLocalIso(iso)))
    .replace(' ', '');
}
