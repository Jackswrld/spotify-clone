/** 61.9 → "1:01", 3725 → "1:02:05". NaN and negatives → "0:00". */
export function formatTime(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** 999 → "999", 1500 → "1.5K", 2 300 000 → "2.3M". */
export function formatCount(n: number): string {
  const abs = Math.abs(n);
  const short = (value: number, suffix: string) =>
    `${Number(value.toFixed(1)).toString()}${suffix}`;
  if (abs >= 1_000_000_000) return short(n / 1_000_000_000, 'B');
  if (abs >= 1_000_000) return short(n / 1_000_000, 'M');
  if (abs >= 1_000) return short(n / 1_000, 'K');
  return String(n);
}
