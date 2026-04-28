'use client';

// Memory + sessionStorage cache for forecast data. Keeps API calls down
// when navigating between Locations and Forecast pages.
type Entry<T> = { at: number; data: T };

const mem = new Map<string, Entry<unknown>>();

export async function cachedFetch<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const memEntry = mem.get(key) as Entry<T> | undefined;
  if (memEntry && now - memEntry.at < ttlMs) return memEntry.data;

  if (typeof window !== 'undefined') {
    try {
      const raw = window.sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Entry<T>;
        if (now - parsed.at < ttlMs) {
          mem.set(key, parsed);
          return parsed.data;
        }
      }
    } catch {
      /* ignore */
    }
  }

  const data = await fn();
  const entry: Entry<T> = { at: now, data };
  mem.set(key, entry);
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(key, JSON.stringify(entry));
    } catch {
      /* quota */
    }
  }
  return data;
}
