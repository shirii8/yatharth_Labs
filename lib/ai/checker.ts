import type { Flag } from "../domain/flags";

/**
 * Checks an AI-written summary before any patient sees it. The model only gets
 * the rule's findings; this checker makes sure it said nothing else. Any
 * problem means the summary is not shown and the patient reads the plain rule
 * lines instead. Problems are plain sentences for the pathologist's review.
 */

export interface AiFacts {
  testName: string;
  results: {
    name: string;
    unit: string;
    valueText: string;
    refText: string;
    flag: Flag;
    /** The rule's words for this result, such as "a little low". */
    words: string;
  }[];
}

export interface CheckResult {
  ok: boolean;
  problems: string[];
}

const MAX_CHARACTERS = 600;
const MAX_SENTENCES = 4;

/** Words that diagnose, name a condition, advise on treatment, alarm or falsely calm. */
const BANNED: { pattern: RegExp; reason: string }[] = [
  { pattern: /diagnos/i, reason: "talks about a diagnosis" },
  { pattern: /disease|disorder|condition|syndrome/i, reason: "names a disease or condition" },
  {
    pattern: /cancer|diabet|anaemi|anemi|thyroid(ism)?\b(?! profile)|infection|kidney|liver|heart/i,
    reason: "names an illness or organ problem",
  },
  {
    pattern: /medicine|medication|tablet|statin|dose|prescri|supplement|treatment|treat\b|cure/i,
    reason: "gives advice on medicine or treatment",
  },
  {
    pattern: /urgent|emergency|critical|abnormal|danger|alarm|serious|risk/i,
    reason: "uses alarming words",
  },
  {
    pattern: /worr|nothing to fear|fine\b|healthy|normal\b/i,
    reason: "reassures or judges beyond the rule",
  },
  {
    pattern: /\byou (have|may have|might have|probably have)\b/i,
    reason: "tells the patient what they have",
  },
];

const LOW_WORDS = /\b(low|lower)\b/i;
const HIGH_WORDS = /\b(high|higher)\b/i;

function numbersIn(text: string): number[] {
  return (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function checkAiSummary(text: string, facts: AiFacts): CheckResult {
  const problems: string[] = [];
  const clean = text.trim();

  if (!clean) return { ok: false, problems: ["The summary is empty."] };
  if (clean.length > MAX_CHARACTERS || sentences(clean).length > MAX_SENTENCES) {
    problems.push(`The summary is longer than ${MAX_SENTENCES} short sentences.`);
  }

  for (const { pattern, reason } of BANNED) {
    const found = clean.match(pattern);
    if (found) problems.push(`It ${reason} ("${found[0]}").`);
  }

  // Every number must be a value or a range limit printed on the report, or a small count.
  const allowed = new Set<number>([
    ...facts.results.flatMap((r) => [...numbersIn(r.valueText), ...numbersIn(r.refText)]),
    ...Array.from({ length: facts.results.length + 1 }, (_, i) => i),
  ]);
  for (const n of numbersIn(clean)) {
    if (!allowed.has(n)) problems.push(`It gives the number ${n}, which is not on the report.`);
  }

  // Each result's words must agree with the rule, and every flagged result must appear.
  const all = sentences(clean);
  for (const r of facts.results) {
    const about = all.filter((s) => s.toLowerCase().includes(r.name.toLowerCase()));
    if (r.flag !== "USUAL" && about.length === 0) {
      problems.push(`It leaves out ${r.name}, which the rule marked ${r.words}.`);
    }
    for (const s of about) {
      // Only the clause naming this result counts, so "A is low, B is high" is judged per name.
      const clause =
        s
          .split(/,|;|\band\b|\bbut\b/i)
          .find((part) => part.toLowerCase().includes(r.name.toLowerCase())) ?? s;
      const saysLow = LOW_WORDS.test(clause);
      const saysHigh = HIGH_WORDS.test(clause);
      const wrong =
        (r.flag === "USUAL" && (saysLow || saysHigh)) ||
        (r.flag === "LOW" && saysHigh) ||
        (r.flag === "HIGH" && saysLow);
      if (wrong) problems.push(`It describes ${r.name} differently from the rule (${r.words}).`);
    }
  }

  return { ok: problems.length === 0, problems };
}
