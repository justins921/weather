'use client';

// Memory + sessionStorage cache for forecast data, with in-flight request
// deduplication. The dedup is the important bit: when the Locations
// dashboard mounts, every LocationCard plus the CourseComparison row
// each calls cachedFetch with the same key in parallel. Without dedup,
// they all see an empty cache, all fire the network, and we burn through
// rate limits in one page load. With dedup, the first call starts the
// request and every subsequent in-flight caller awaits the same promise.

type Entry<T> = { at: number; data: T };

const mem = new Map<string, Entry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

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

  // Coalesce parallel callers onto a single network round-trip per key.
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async () => {
    try {
      const data = await fn();
      const entry: Entry<T> = { at: Date.now(), data };
      mem.set(key, entry);
      if (typeof window !== 'undefined') {
        try {
          window.sessionStorage.setItem(key, JSON.stringify(entry));
        } catch {
          /* quota */
        }
      }
      return data;
    } catch (err) {
      // Upstream outage: hand back the last-known-good entry even if it's
      // past TTL. Better to render slightly stale data than fail every card.
      const stale = mem.get(key) as Entry<T> | undefined;
      if (stale) return stale.data;
      if (typeof window !== 'undefined') {
        try {
          const raw = window.sessionStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw) as Entry<T>;
            return parsed.data;
          }
        } catch {
          /* ignore */
        }
      }
      throw err;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}
