import { describe, expect, it } from "vitest";
import { REQUIRED_COLUMNS, missingColumns, validateRows, type TestCatalog } from "./validate";

const catalog: TestCatalog = {
  CBC: { analytes: [{ code: "HB", name: "Haemoglobin", unit: "g/dL" }] },
  LIPID: { analytes: [{ code: "LDL", name: "LDL cholesterol", unit: "mg/dL" }] },
  ELEC: { analytes: [{ code: "K", name: "Potassium", unit: "mmol/L" }] },
};

function row(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    "Order ID": "ORD-71204",
    Patient: "Lakshmi Prasanna K",
    Phone: "+91 90000 00001",
    Age: "64",
    Sex: "F",
    Relation: "Self",
    "Test Code": "CBC",
    Parameter: "Haemoglobin g/dL",
    Result: "10.2",
    "Reference Range": "12.0-15.5",
    Status: "Ready",
    "Referring Doctor": "Dr. S. Ramanaiah",
    "Signed At": "2026-11-04T09:30:00+05:30",
    ...overrides,
  };
}

describe("missingColumns", () => {
  it("lists required columns the file does not have", () => {
    expect(missingColumns(["Order ID", "Patient"])).toContain("Phone");
    expect(missingColumns(REQUIRED_COLUMNS)).toEqual([]);
  });
});

describe("validateRows", () => {
  it("accepts the brief's sample row and reads every field", () => {
    const { valid, errors } = validateRows([row()], catalog);
    expect(errors).toEqual([]);
    expect(valid[0]).toMatchObject({
      rowNumber: 2,
      orderId: "ORD-71204",
      phone: "+919000000001",
      age: 64,
      sex: "FEMALE",
      testCode: "CBC",
      analyteCode: "HB",
      value: 10.2,
      valueText: "10.2",
      range: { low: 12, high: 15.5 },
      status: "SIGNED",
      lisCritical: false,
      referringDoctor: "Dr. S. Ramanaiah",
    });
  });

  it("matches a parameter by name alone or by name and unit", () => {
    const { valid } = validateRows([row({ Parameter: "haemoglobin" })], catalog);
    expect(valid[0]?.analyteCode).toBe("HB");
  });

  it("reads Ready (critical) as signed and marked critical by the LIS", () => {
    const { valid } = validateRows(
      [
        row({
          "Test Code": "ELEC",
          Parameter: "Potassium mmol/L",
          Result: "6.8",
          "Reference Range": "3.5-5.1",
          Status: "Ready (critical)",
        }),
      ],
      catalog,
    );
    expect(valid[0]).toMatchObject({ status: "SIGNED", lisCritical: true });
  });

  it("reads Processing as tested but not signed, and allows a blank result", () => {
    const { valid, errors } = validateRows([row({ Status: "Processing", Result: "" })], catalog);
    expect(errors).toEqual([]);
    expect(valid[0]).toMatchObject({ status: "TESTED", value: null });
  });

  it("explains a bad phone number in a sentence staff can act on", () => {
    const { errors } = validateRows([row({ Phone: "900000001" })], catalog);
    expect(errors[0]?.rowNumber).toBe(2);
    expect(errors[0]?.messages[0]).toMatch(/phone number .*10-digit Indian mobile/i);
  });

  it("explains an unknown test code and lists the known ones", () => {
    const { errors } = validateRows([row({ "Test Code": "XYZ" })], catalog);
    expect(errors[0]?.messages[0]).toMatch(/test code "XYZ".*CBC, ELEC, LIPID/);
  });

  it("explains a parameter that does not belong to the test", () => {
    const { errors } = validateRows([row({ Parameter: "Potassium" })], catalog);
    expect(errors[0]?.messages[0]).toMatch(/"Potassium" is not part of CBC/);
  });

  it("refuses a result that is not a number on a ready report", () => {
    const { errors } = validateRows([row({ Result: "high" })], catalog);
    expect(errors[0]?.messages[0]).toMatch(/result "high" is not a number/i);
  });

  it("refuses a reference range it cannot read", () => {
    const { errors } = validateRows([row({ "Reference Range": "see note" })], catalog);
    expect(errors[0]?.messages[0]).toMatch(/reference range "see note"/i);
  });

  it("refuses an unknown status, age or sex", () => {
    const { errors } = validateRows([row({ Status: "Done", Age: "abc", Sex: "X" })], catalog);
    expect(errors[0]?.messages).toHaveLength(3);
  });

  it("lists every problem on a row, not only the first", () => {
    const { errors } = validateRows([row({ Phone: "", "Order ID": "", Result: "x" })], catalog);
    expect(errors[0]?.messages.length).toBeGreaterThanOrEqual(3);
  });

  it("refuses rows of one order and test that disagree on the patient", () => {
    const rows = [
      row(),
      row({ Patient: "Someone Else", Parameter: "Haemoglobin", Result: "11" }),
    ];
    const { valid, errors } = validateRows(rows, catalog);
    expect(valid).toHaveLength(1);
    expect(errors[0]?.rowNumber).toBe(3);
    expect(errors[0]?.messages[0]).toMatch(/ORD-71204 .*different patient or phone/i);
  });

  it("refuses the same parameter twice on one order and test", () => {
    const { errors } = validateRows([row(), row()], catalog);
    expect(errors[0]?.rowNumber).toBe(3);
    expect(errors[0]?.messages[0]).toMatch(/appears twice/i);
  });

  it("keeps good rows when other rows are bad", () => {
    const rows = [row(), row({ "Order ID": "ORD-2", Phone: "123" })];
    const { valid, errors } = validateRows(rows, catalog);
    expect(valid).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });
});
