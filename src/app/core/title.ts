/** Lower case, accents removed, non-alphanumerics to single spaces. */
function base(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Removes "(feat. X)", "[ft. X]" and trailing "feat. X" parts. */
function withoutFeat(s: string): string {
  return s
    .replace(/[([](?:feat|ft|featuring)\.?\s[^)\]]*[)\]]/gi, '')
    .replace(/\s(?:feat|ft|featuring)\.?\s.*$/i, '');
}

/**
 * Loose key for matching the same song across sources (also used by the relay cache):
 * drops every bracketed part ("(Remix)", "[Live]") and "feat." credits.
 */
export function normalise(s: string): string {
  return base(withoutFeat(s).replace(/\s*[([][^)\]]*[)\]]/g, ''));
}

/** Strict key for "exactly the same title": only "feat." credits, case and accents are ignored. */
export function exactKey(s: string): string {
  return base(withoutFeat(s));
}
