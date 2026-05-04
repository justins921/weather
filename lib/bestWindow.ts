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
