import { describe, expect, it } from "vitest";
import { buildSummary, severity, type SummaryInput } from "./builder";
import { DEFAULT_TEMPLATES } from "./templates";

const en = new Map(Object.entries(DEFAULT_TEMPLATES.EN));

function cbc(hb: number, flag: "LOW" | "USUAL" | "HIGH"): SummaryInput {
  return {
    testCode: "CBC",
    testName: "Complete Blood Count",
    hasCritical: false,
    results: [
      {
        name: "Haemoglobin",
        helper: "Carries oxygen.",
        unit: "g/dL",
        value: hb,
        valueText: String(hb),
        refLow: 12,
        refHigh: 15.5,
        refText: "12.0-15.5",
        flag,
      },
      {
        name: "White blood cells",
        helper: "Fight infection.",
        unit: "x10^3/uL",
        value: 7.1,
        valueText: "7.1",
        refLow: 4,
        refHigh: 11,
        refText: "4.0-11.0",
        flag: "USUAL",
      },
      {
        name: "Platelets",
        helper: "Help clotting.",
        unit: "x10^3/uL",
        value: 262,
        valueText: "262",
        refLow: 150,
        refHigh: 410,
        refText: "150-410",
        flag: "USUAL",
      },
    ],
  };
}

/** Turns each template body into a pattern, so any sentence can be traced to one. */
function templatePatterns(templates: Map<string, string>): RegExp[] {
  return [...templates.values()].map(
    (body) =>
      new RegExp("^" + body.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{\w+\}/g, ".+?") + "$"),
  );
}

describe("severity", () => {
  it("is mild just outside the range and marked well outside it", () => {
    expect(severity(10.2, { low: 12, high: 15.5 })).toBe("MILD");
    expect(severity(8.0, { low: 12, high: 15.5 })).toBe("MARKED");
    expect(severity(142, { low: 0, high: 100 })).toBe("MARKED");
    expect(severity(110, { low: 0, high: 100 })).toBe("MILD");
  });

  it("works for one-sided ranges", () => {
    expect(severity(38, { low: 40, high: null })).toBe("MILD");
    expect(severity(25, { low: 40, high: null })).toBe("MARKED");
    expect(severity(162, { low: null, high: 150 })).toBe("MILD");
  });
});

describe("buildSummary", () => {
  it("says a critical report has no summary at all", () => {
    const summary = buildSummary({ ...cbc(10.2, "LOW"), hasCritical: true }, en);
    expect(summary).toEqual({ kind: "CRITICAL" });
  });

  it("explains the low haemoglobin with the rule's words", () => {
    const summary = buildSummary(cbc(10.2, "LOW"), en);
    if (summary.kind !== "RESULTS") throw new Error("expected results");
    expect(summary.intro).toBe(
      "Of 3 results, 2 are in the usual range. Haemoglobin is a little low.",
    );
    expect(summary.items[0]).toMatchObject({
      word: "A little low.",
      tone: "ATTENTION",
      rule: "Marked by the lab's rule: below 12.0, the lower end of the range printed on your signed report.",
    });
    expect(summary.items[1]).toMatchObject({ word: "In the usual range.", tone: "USUAL" });
  });

  it("says all usual when nothing is flagged", () => {
    const summary = buildSummary(cbc(13.4, "USUAL"), en);
    if (summary.kind !== "RESULTS") throw new Error("expected results");
    expect(summary.intro).toBe("All 3 results are in the usual range.");
  });

  it("uses the flag from the rule, never its own judgement of the value", () => {
    // The stored flag says USUAL, so the words must say usual even for an odd value.
    const summary = buildSummary(cbc(10.2, "USUAL"), en);
    if (summary.kind !== "RESULTS") throw new Error("expected results");
    expect(summary.items[0]?.word).toBe("In the usual range.");
  });

  it("only ever produces sentences that exist in an approved template", () => {
    const patterns = templatePatterns(en);
    for (const input of [cbc(10.2, "LOW"), cbc(13.4, "USUAL"), cbc(8, "LOW"), cbc(17, "HIGH")]) {
      const summary = buildSummary(input, en);
      if (summary.kind !== "RESULTS") throw new Error("expected results");
      const sentences = [
        ...summary.intro.split(/(?<=\.) /),
        ...summary.items.flatMap((i) => [i.word, i.sentence, i.rule]),
        ...summary.nextSteps,
        summary.footer,
      ];
      for (const sentence of sentences) {
        expect(
          patterns.some((p) => p.test(sentence)),
          `not from a template: "${sentence}"`,
        ).toBe(true);
      }
    }
  });

  it("falls back to English for a key with no approved translation", () => {
    const te = new Map([["word.usual", "సాధారణ పరిధిలో ఉంది."]]);
    const summary = buildSummary(cbc(13.4, "USUAL"), te, en);
    if (summary.kind !== "RESULTS") throw new Error("expected results");
    expect(summary.items[1]?.word).toBe("సాధారణ పరిధిలో ఉంది.");
    expect(summary.intro).toBe("All 3 results are in the usual range.");
  });
});
