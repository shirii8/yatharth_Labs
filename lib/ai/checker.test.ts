import { describe, expect, it } from "vitest";
import { checkAiSummary, type AiFacts } from "./checker";

const lipid: AiFacts = {
  testName: "Lipid Profile",
  results: [
    {
      name: "Total cholesterol",
      unit: "mg/dL",
      valueText: "214",
      refText: "<200",
      flag: "HIGH",
      words: "a little high",
    },
    {
      name: "LDL cholesterol",
      unit: "mg/dL",
      valueText: "138",
      refText: "0-100",
      flag: "HIGH",
      words: "much higher than usual",
    },
    {
      name: "HDL cholesterol",
      unit: "mg/dL",
      valueText: "38",
      refText: ">40",
      flag: "LOW",
      words: "a little low",
    },
    {
      name: "Triglycerides",
      unit: "mg/dL",
      valueText: "162",
      refText: "<150",
      flag: "HIGH",
      words: "a little high",
    },
  ],
};

const good =
  "Your LDL cholesterol is much higher than usual at 138, against a usual range up to 100. Total cholesterol and triglycerides are a little high, and HDL cholesterol is a little low. Your doctor will explain what this means for you.";

describe("checkAiSummary", () => {
  it("accepts a summary that only restates the rule's findings", () => {
    expect(checkAiSummary(good, lipid)).toEqual({ ok: true, problems: [] });
  });

  it("refuses a number that is not on the report", () => {
    const result = checkAiSummary(good.replace("138", "183"), lipid);
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toMatch(/183/);
  });

  it("accepts printed numbers written without the trailing zero", () => {
    const facts: AiFacts = {
      testName: "Complete Blood Count",
      results: [
        {
          name: "Haemoglobin",
          unit: "g/dL",
          valueText: "10.2",
          refText: "12.0-15.5",
          flag: "LOW",
          words: "a little low",
        },
      ],
    };
    const text = "Haemoglobin is a little low at 10.2, below the usual 12 to 15.5.";
    expect(checkAiSummary(text, facts).ok).toBe(true);
  });

  it("refuses a diagnosis, a disease name or advice on medicine", () => {
    for (const bad of [
      "This suggests heart disease.",
      "You may have anaemia.",
      "You should take a statin tablet.",
      "Your doctor may diagnose diabetes.",
    ]) {
      expect(checkAiSummary(`${good} ${bad}`, lipid).ok, bad).toBe(false);
    }
  });

  it("refuses alarming or falsely calming words", () => {
    for (const bad of [
      "This is urgent.",
      "This is abnormal.",
      "There is nothing to worry about.",
    ]) {
      expect(checkAiSummary(`${good} ${bad}`, lipid).ok, bad).toBe(false);
    }
  });

  it("refuses a flag word that disagrees with the rule", () => {
    const result = checkAiSummary(
      good.replace("HDL cholesterol is a little low", "HDL cholesterol is a little high"),
      lipid,
    );
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toMatch(/HDL cholesterol/);
  });

  it("refuses a summary that leaves out a flagged result", () => {
    const result = checkAiSummary(
      "Your LDL cholesterol is much higher than usual. Your doctor will explain what this means for you.",
      lipid,
    );
    expect(result.ok).toBe(false);
    expect(result.problems.join(" ")).toMatch(/HDL cholesterol/);
  });

  it("refuses an empty or very long answer", () => {
    expect(checkAiSummary("  ", lipid).ok).toBe(false);
    expect(checkAiSummary(good.repeat(4), lipid).ok).toBe(false);
  });
});
