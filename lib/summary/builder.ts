import type { Flag, Range } from "../domain/flags";

/**
 * Builds what a patient reads about a report. Rules choose template keys and
 * fill placeholders; templates supply every word. There is no free text here.
 * A critical report gets no summary at all.
 */

export type Severity = "MILD" | "MARKED";

/**
 * More than 20% past the printed limit that was crossed counts as marked:
 * haemoglobin 10.2 against 12.0 is 15% under, so "a little low"; LDL 142
 * against 100 is 42% over, so "much higher than usual".
 */
const MARKED_SHARE = 0.2;

export function severity(value: number, range: Range): Severity {
  if (range.low !== null && value < range.low) {
    return range.low - value > Math.abs(range.low) * MARKED_SHARE ? "MARKED" : "MILD";
  }
  if (range.high !== null && value > range.high) {
    return value - range.high > Math.abs(range.high) * MARKED_SHARE ? "MARKED" : "MILD";
  }
  return "MILD";
}

export interface SummaryResult {
  name: string;
  helper: string;
  unit: string;
  value: number;
  valueText: string;
  refLow: number | null;
  refHigh: number | null;
  refText: string;
  /** The flag stored by the import rule. The builder never recomputes it. */
  flag: Flag;
}

export interface SummaryInput {
  testCode: string;
  testName: string;
  hasCritical: boolean;
  results: SummaryResult[];
}

export interface SummaryItem extends SummaryResult {
  severity: Severity | null;
  word: string;
  sentence: string;
  rule: string;
  tone: "USUAL" | "ATTENTION";
}

export type Summary =
  | { kind: "CRITICAL" }
  | {
      kind: "RESULTS";
      intro: string;
      items: SummaryItem[];
      nextSteps: string[];
      footer: string;
    };

type Templates = Map<string, string>;

/** The bounds as printed on the report, so "12.0" is never shown as "12". */
function printedBounds(refText: string): { low: string; high: string } {
  const numbers = refText.match(/\d+(?:\.\d+)?/g) ?? [];
  if (refText.trim().startsWith("<")) return { low: "", high: numbers[0] ?? "" };
  if (refText.trim().startsWith(">")) return { low: numbers[0] ?? "", high: "" };
  return { low: numbers[0] ?? "", high: numbers[1] ?? "" };
}

export function buildSummary(
  input: SummaryInput,
  templates: Templates,
  fallback: Templates = templates,
): Summary {
  if (input.hasCritical) return { kind: "CRITICAL" };

  const text = (key: string, values: Record<string, string | number> = {}) => {
    const body = templates.get(key) ?? fallback.get(key);
    if (body === undefined) throw new Error(`Missing template "${key}"`);
    return body.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
  };

  const items: SummaryItem[] = input.results.map((r) => {
    const bounds = printedBounds(r.refText);
    if (r.flag === "USUAL") {
      return {
        ...r,
        severity: null,
        word: text("word.usual"),
        sentence: text("sentence.usual"),
        rule: text("rule.usual"),
        tone: "USUAL",
      };
    }
    const level = severity(r.value, { low: r.refLow, high: r.refHigh });
    const side = r.flag === "LOW" ? "low" : "high";
    const grade = level === "MARKED" ? "marked" : "mild";
    return {
      ...r,
      severity: level,
      word: text(`word.${side}.${grade}`),
      sentence: text("sentence.flagged"),
      rule: text(`rule.${side}`, { low: bounds.low, high: bounds.high }),
      tone: "ATTENTION",
    };
  });

  const flagged = items.filter((i) => i.tone === "ATTENTION");
  const count = items.length;
  const intro =
    flagged.length === 0
      ? text("intro.all_usual", { count })
      : [
          text("intro.count", { count, usual: count - flagged.length }),
          ...flagged.map((i) =>
            text(
              `flag.${i.flag === "LOW" ? "low" : "high"}.${i.severity === "MARKED" ? "marked" : "mild"}`,
              {
                analyte: i.name,
              },
            ),
          ),
        ].join(" ");

  const testStep = `test.${input.testCode}.next`;
  const nextSteps =
    flagged.length > 0
      ? [
          text("next.flagged.1"),
          ...(templates.has(testStep) || fallback.has(testStep) ? [text(testStep)] : []),
          text("next.any.call"),
        ]
      : [text("next.usual.1"), text("next.any.call")];

  return { kind: "RESULTS", intro, items, nextSteps, footer: text("footer") };
}
