/**
 * Out-of-range flags. Decided only by these rules, against the range printed
 * on the signed report. AI never sets or changes a flag.
 */

export type Flag = "LOW" | "USUAL" | "HIGH";

/** A usual range. Either side may be open, as in "<100" or ">40". */
export interface Range {
  low: number | null;
  high: number | null;
}

const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const BETWEEN = new RegExp(String.raw`^${NUMBER}\s*(?:-|–|to)\s*${NUMBER}$`, "i");
const BELOW = new RegExp(String.raw`^<\s*=?\s*${NUMBER}$`);
const ABOVE = new RegExp(String.raw`^>\s*=?\s*${NUMBER}$`);

/** Reads a range as printed, for example "12.0-15.5", "<100" or ">40". Null if unreadable. */
export function parseRange(text: string): Range | null {
  const t = text.trim();

  const between = BETWEEN.exec(t);
  if (between) {
    const low = Number(between[1]);
    const high = Number(between[2]);
    return low <= high ? { low, high } : null;
  }

  const below = BELOW.exec(t);
  if (below) return { low: null, high: Number(below[1]) };

  const above = ABOVE.exec(t);
  if (above) return { low: Number(above[1]), high: null };

  return null;
}

/** LOW below the range, HIGH above it, USUAL inside it. Printed boundaries count as usual. */
export function flagForValue(value: number, range: Range): Flag {
  if (range.low !== null && value < range.low) return "LOW";
  if (range.high !== null && value > range.high) return "HIGH";
  return "USUAL";
}
