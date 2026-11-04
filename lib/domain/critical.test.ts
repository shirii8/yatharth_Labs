import { describe, expect, it } from "vitest";
import { isCritical, reportHasCritical } from "./critical";

describe("isCritical", () => {
  const potassium = { criticalLow: 2.8, criticalHigh: 6.0 };

  it("is critical above the high limit", () => {
    expect(isCritical(6.8, potassium)).toBe(true);
  });

  it("is critical below the low limit", () => {
    expect(isCritical(2.5, potassium)).toBe(true);
  });

  it("is not critical between the limits", () => {
    expect(isCritical(5.4, potassium)).toBe(false);
  });

  it("counts reaching a limit as critical, to err on the side of a call", () => {
    expect(isCritical(6.0, potassium)).toBe(true);
    expect(isCritical(2.8, potassium)).toBe(true);
  });

  it("is never critical when the analyte has no limits", () => {
    expect(isCritical(142, { criticalLow: null, criticalHigh: null })).toBe(false);
  });

  it("checks one side when only one limit is set", () => {
    expect(isCritical(6.5, { criticalLow: 7.0, criticalHigh: null })).toBe(true);
    expect(isCritical(18, { criticalLow: 7.0, criticalHigh: null })).toBe(false);
  });
});

describe("reportHasCritical", () => {
  it("is true if any result is critical by rule", () => {
    expect(reportHasCritical([false, true, false], false)).toBe(true);
  });

  it("is true if the LIS export marked the report critical, even if no rule fired", () => {
    expect(reportHasCritical([false, false], true)).toBe(true);
  });

  it("is false only when no rule fired and the LIS did not mark it", () => {
    expect(reportHasCritical([false, false], false)).toBe(false);
  });
});
