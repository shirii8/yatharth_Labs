import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("reads a header and rows into records", () => {
    const out = parseCsv("Order ID,Patient\nORD-1,Lakshmi\nORD-2,Venkata\n");
    expect(out.header).toEqual(["Order ID", "Patient"]);
    expect(out.records).toEqual([
      { "Order ID": "ORD-1", Patient: "Lakshmi" },
      { "Order ID": "ORD-2", Patient: "Venkata" },
    ]);
  });

  it("handles quoted fields with commas, quotes and new lines", () => {
    const out = parseCsv('A,B\n"Rao, M","He said ""hi"""\n"line\nbreak",x\n');
    expect(out.records[0]).toEqual({ A: "Rao, M", B: 'He said "hi"' });
    expect(out.records[1]).toEqual({ A: "line\nbreak", B: "x" });
  });

  it("handles Windows line endings and a byte order mark from Excel", () => {
    const out = parseCsv("﻿A,B\r\n1,2\r\n");
    expect(out.header).toEqual(["A", "B"]);
    expect(out.records).toEqual([{ A: "1", B: "2" }]);
  });

  it("trims header names and skips blank lines", () => {
    const out = parseCsv(" A , B \n1,2\n\n3,4\n");
    expect(out.header).toEqual(["A", "B"]);
    expect(out.records).toHaveLength(2);
  });

  it("gives missing trailing cells as empty text", () => {
    expect(parseCsv("A,B,C\n1,2\n").records[0]).toEqual({ A: "1", B: "2", C: "" });
  });
});
