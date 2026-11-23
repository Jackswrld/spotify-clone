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

  /**
   * Reads an array of objects that each have a string `id`. A non-array value or
   * malformed entries (null, numbers, objects without an id) are dropped.
   */
  getArray<T extends { id: string }>(key: string): T[] {
    const value = safeStorage.get<unknown>(key, []);
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is T => typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string',
    );
  },

  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable or full: keep working in memory.
    }
  },
};
