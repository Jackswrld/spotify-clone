/**
 * localStorage that never throws: corrupt JSON, private mode or a full quota
 * fall back to defaults (reads) or are silently ignored (writes).
 */
export const safeStorage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },

  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable or full: keep working in memory.
    }
  },
};
