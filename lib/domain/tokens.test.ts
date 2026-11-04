import { describe, expect, it } from "vitest";
import {
  LINK_TTL_HOURS,
  generateToken,
  hashSecret,
  isLinkValid,
  linkExpiresAt,
  safeEqual,
} from "./tokens";

const KEY = "test-key-not-a-secret";

describe("generateToken", () => {
  it("makes a URL-safe token with 256 bits of randomness", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("never repeats", () => {
    const seen = new Set(Array.from({ length: 1000 }, generateToken));
    expect(seen.size).toBe(1000);
  });
});

describe("hashSecret", () => {
  it("is stable for the same token and key", () => {
    expect(hashSecret("abc", KEY)).toBe(hashSecret("abc", KEY));
  });

  it("changes with the key, so a stolen table is useless without it", () => {
    expect(hashSecret("abc", KEY)).not.toBe(hashSecret("abc", "other-key"));
  });

  it("never contains the token itself", () => {
    const token = generateToken();
    expect(hashSecret(token, KEY)).not.toContain(token);
  });
});

describe("safeEqual", () => {
  it("compares in constant time and returns the right answer", () => {
    expect(safeEqual("a1b2", "a1b2")).toBe(true);
    expect(safeEqual("a1b2", "a1b3")).toBe(false);
    expect(safeEqual("a1b2", "a1b")).toBe(false);
  });
});

describe("link expiry (72 hours)", () => {
  const created = new Date("2026-11-04T10:00:00.000Z");
  const expiresAt = linkExpiresAt(created);

  it("expires exactly 72 hours after creation", () => {
    expect(LINK_TTL_HOURS).toBe(72);
    expect(expiresAt.toISOString()).toBe("2026-11-07T10:00:00.000Z");
  });

  it("is valid one millisecond before expiry", () => {
    const now = new Date(expiresAt.getTime() - 1);
    expect(isLinkValid({ expiresAt, revokedAt: null }, now)).toBe(true);
  });

  it("is not valid at the moment of expiry", () => {
    expect(isLinkValid({ expiresAt, revokedAt: null }, expiresAt)).toBe(false);
  });

  it("is not valid after expiry", () => {
    const now = new Date(expiresAt.getTime() + 60_000);
    expect(isLinkValid({ expiresAt, revokedAt: null }, now)).toBe(false);
  });

  it("is not valid once revoked, even inside 72 hours", () => {
    const now = new Date(created.getTime() + 60_000);
    expect(isLinkValid({ expiresAt, revokedAt: created }, now)).toBe(false);
  });
});
