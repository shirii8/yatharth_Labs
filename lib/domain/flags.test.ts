import { describe, expect, it } from "vitest";
import { flagForValue, parseRange } from "./flags";

describe("parseRange", () => {
  it("reads a low-high range as printed on the report", () => {
    expect(parseRange("12.0-15.5")).toEqual({ low: 12, high: 15.5 });
    expect(parseRange("3.5 - 5.1")).toEqual({ low: 3.5, high: 5.1 });
    expect(parseRange("0-100")).toEqual({ low: 0, high: 100 });
  });

  it("reads one-sided ranges", () => {
    expect(parseRange("<100")).toEqual({ low: null, high: 100 });
    expect(parseRange("< 200")).toEqual({ low: null, high: 200 });
    expect(parseRange(">40")).toEqual({ low: 40, high: null });
  });

  it("accepts an en dash or the word 'to'", () => {
    expect(parseRange("12.0–15.5")).toEqual({ low: 12, high: 15.5 });
    expect(parseRange("12.0 to 15.5")).toEqual({ low: 12, high: 15.5 });
  });

  it("returns null for text that is not a range", () => {
    expect(parseRange("")).toBeNull();
    expect(parseRange("normal")).toBeNull();
    expect(parseRange("15.5-12.0")).toBeNull();
    expect(parseRange("12-abc")).toBeNull();
  });
});

describe("flagForValue", () => {
  const hb = { low: 12, high: 15.5 };

  it("flags a value below the range as LOW", () => {
    expect(flagForValue(10.2, hb)).toBe("LOW");
  });

  it("flags a value above the range as HIGH", () => {
    expect(flagForValue(16, hb)).toBe("HIGH");
  });

  it("treats values inside the range as USUAL", () => {
    expect(flagForValue(13.4, hb)).toBe("USUAL");
  });

  it("treats both printed boundaries as USUAL", () => {
    expect(flagForValue(12, hb)).toBe("USUAL");
    expect(flagForValue(15.5, hb)).toBe("USUAL");
  });

  it("flags just outside each boundary", () => {
    expect(flagForValue(11.9, hb)).toBe("LOW");
    expect(flagForValue(15.6, hb)).toBe("HIGH");
  });

  it("handles one-sided ranges", () => {
    expect(flagForValue(142, { low: null, high: 100 })).toBe("HIGH");
    expect(flagForValue(35, { low: 40, high: null })).toBe("LOW");
    expect(flagForValue(55, { low: 40, high: null })).toBe("USUAL");
  });

  it("flags the sample LDL and potassium values from the brief", () => {
    expect(flagForValue(142, parseRange("0-100")!)).toBe("HIGH");
    expect(flagForValue(6.8, parseRange("3.5-5.1")!)).toBe("HIGH");
  });
});
