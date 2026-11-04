import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptPhone, encryptPhone, hashPhone, maskPhone, normalisePhone } from "./phone";

describe("normalisePhone", () => {
  it("accepts the ways people type an Indian mobile number", () => {
    expect(normalisePhone("9000000001")).toBe("+919000000001");
    expect(normalisePhone("+91 90000 00001")).toBe("+919000000001");
    expect(normalisePhone("+91-90000-00001")).toBe("+919000000001");
    expect(normalisePhone("09000000001")).toBe("+919000000001");
    expect(normalisePhone("919000000001")).toBe("+919000000001");
    expect(normalisePhone(" 6000000001 ")).toBe("+916000000001");
  });

  it("refuses numbers that are not Indian mobiles", () => {
    expect(normalisePhone("900000001")).toBeNull(); // 9 digits
    expect(normalisePhone("90000000012")).toBeNull(); // 11 digits, no 0 or 91 prefix
    expect(normalisePhone("5000000001")).toBeNull(); // mobiles start with 6 to 9
    expect(normalisePhone("+1 415 555 0100")).toBeNull();
    expect(normalisePhone("phone")).toBeNull();
    expect(normalisePhone("")).toBeNull();
  });
});

describe("maskPhone", () => {
  it("shows only the last four digits", () => {
    expect(maskPhone("+919000003210")).toBe("+91 ••••• •3210");
  });
});

describe("hashPhone", () => {
  it("gives the same hash for every way of typing the same number", () => {
    const key = "test-key";
    const a = hashPhone(normalisePhone("90000 00001")!, key);
    const b = hashPhone(normalisePhone("+91 9000000001")!, key);
    expect(a).toBe(b);
  });
});

describe("encryptPhone and decryptPhone", () => {
  const key = randomBytes(32).toString("base64");

  it("round-trips the number", () => {
    const cipher = encryptPhone("+919000000001", key);
    expect(decryptPhone(cipher, key)).toBe("+919000000001");
  });

  it("does not contain the number in the ciphertext", () => {
    expect(encryptPhone("+919000000001", key)).not.toContain("9000000001");
  });

  it("uses a fresh nonce each time", () => {
    expect(encryptPhone("+919000000001", key)).not.toBe(encryptPhone("+919000000001", key));
  });

  it("refuses a tampered ciphertext", () => {
    const cipher = encryptPhone("+919000000001", key);
    const tampered = cipher.slice(0, -2) + (cipher.endsWith("A") ? "B" : "A") + cipher.slice(-1);
    expect(() => decryptPhone(tampered, key)).toThrow();
  });
});
