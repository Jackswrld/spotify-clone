// Test helper: fake window.matchMedia driven by a viewport width.
type Listener = (e: { matches: boolean }) => void;

export interface FakeMedia {
  setWidth(width: number): void;
  restore(): void;
}

export function installFakeMatchMedia(initialWidth: number): FakeMedia {
  let width = initialWidth;
  const queries: { maxWidth: number; listeners: Listener[]; mql: { matches: boolean } }[] = [];
  const original = window.matchMedia;

  window.matchMedia = ((query: string) => {
    const maxWidth = Number(/max-width:\s*([\d.]+)px/.exec(query)?.[1] ?? Infinity);
    const entry = {
      maxWidth,
      listeners: [] as Listener[],
      mql: {} as { matches: boolean },
    };
    const mql = {
      get matches() {
        return width <= maxWidth;
      },
      media: query,
      addEventListener: (_: string, l: Listener) => entry.listeners.push(l),
      removeEventListener: (_: string, l: Listener) => {
        entry.listeners = entry.listeners.filter((x) => x !== l);
      },
    };
    entry.mql = mql;
    queries.push(entry);
    return mql as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  return {
    setWidth(next: number) {
      width = next;
      for (const q of queries) q.listeners.forEach((l) => l({ matches: next <= q.maxWidth }));
    },
    restore() {
      window.matchMedia = original;
    },
  };
}
