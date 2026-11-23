import { LyricLine } from '../models';

const TIMESTAMP = /\[(\d{1,3}):(\d{1,2}(?:\.\d{1,3})?)\]/g;

/** Parses LRC text ("[mm:ss.xx] words") into time-sorted lines. Metadata tags are skipped. */
export function parseLrc(lrc: string | null | undefined): LyricLine[] {
  if (!lrc) return [];
  const out: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const times: number[] = [];
    let end = 0;
    TIMESTAMP.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TIMESTAMP.exec(raw)) && match.index === end) {
      times.push(Number(match[1]) * 60 + Number(match[2]));
      end = TIMESTAMP.lastIndex;
    }
    if (!times.length) continue;
    const text = raw.slice(end).trim();
    for (const time of times) out.push({ time: Math.round(time * 1000) / 1000, text });
  }
  return out.sort((a, b) => a.time - b.time);
}
