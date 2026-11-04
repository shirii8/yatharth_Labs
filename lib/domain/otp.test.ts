import { describe, expect, it } from "vitest";
import {
  DAILY_CAP,
  LOCK_MINUTES,
  MAX_ATTEMPTS,
  OTP_TTL_MINUTES,
  RESEND_COOLDOWN_SECONDS,
  decideIssue,
  decideVerify,
  generateOtp,
} from "./otp";

const now = new Date("2026-11-04T10:00:00.000Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);
const ahead = (seconds: number) => new Date(now.getTime() + seconds * 1000);

describe("the brief's numbers", () => {
  it("codes last 10 minutes, 5 wrong tries pause the number for 15 minutes", () => {
    expect(OTP_TTL_MINUTES).toBe(10);
    expect(MAX_ATTEMPTS).toBe(5);
    expect(LOCK_MINUTES).toBe(15);
    expect(RESEND_COOLDOWN_SECONDS).toBe(60);
    expect(DAILY_CAP).toBe(5);
  });
});

describe("generateOtp", () => {
  it("makes six digits, keeping leading zeros", () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });
});

describe("decideIssue", () => {
  it("allows the first code of the day", () => {
    expect(decideIssue([], now)).toEqual({ ok: true });
  });

  it("refuses a resend within 60 seconds and says when to try", () => {
    const result = decideIssue([{ createdAt: ago(59), lockedUntil: null }], now);
    expect(result).toEqual({ ok: false, reason: "COOLDOWN", retryAt: ahead(1) });
  });

  it("allows a resend at 60 seconds", () => {
    expect(decideIssue([{ createdAt: ago(60), lockedUntil: null }], now)).toEqual({ ok: true });
  });

  it("refuses the sixth code in 24 hours", () => {
    const recent = [3600, 7200, 10800, 14400, 18000].map((s) => ({
      createdAt: ago(s),
      lockedUntil: null,
    }));
    const result = decideIssue(recent, now);
    expect(result).toMatchObject({ ok: false, reason: "DAILY_CAP" });
  });

  it("does not count codes older than 24 hours", () => {
    const recent = [90000, 91000, 92000, 93000, 94000].map((s) => ({
      createdAt: ago(s),
      lockedUntil: null,
    }));
    expect(decideIssue(recent, now)).toEqual({ ok: true });
  });

  it("refuses any code while the number is paused", () => {
    const result = decideIssue([{ createdAt: ago(300), lockedUntil: ahead(600) }], now);
    expect(result).toEqual({ ok: false, reason: "LOCKED", retryAt: ahead(600) });
  });
});

describe("decideVerify", () => {
  const challenge = {
    codeHash: "right",
    attempts: 0,
    expiresAt: ahead(300),
    consumedAt: null,
    lockedUntil: null,
  };

  it("accepts the right code", () => {
    expect(decideVerify(challenge, "right", now)).toEqual({ result: "OK" });
  });

  it("counts a wrong code and says how many tries are left", () => {
    expect(decideVerify(challenge, "wrong", now)).toEqual({
      result: "WRONG",
      attempts: 1,
      attemptsLeft: 4,
    });
  });

  it("pauses the number for 15 minutes on the fifth wrong code", () => {
    const result = decideVerify({ ...challenge, attempts: 4 }, "wrong", now);
    expect(result).toEqual({ result: "LOCKED", attempts: 5, lockedUntil: ahead(15 * 60) });
  });

  it("refuses even the right code while paused", () => {
    const result = decideVerify({ ...challenge, lockedUntil: ahead(60) }, "right", now);
    expect(result).toMatchObject({ result: "LOCKED" });
  });

  it("refuses an expired code, even if right", () => {
    expect(decideVerify({ ...challenge, expiresAt: now }, "right", now)).toEqual({
      result: "EXPIRED",
    });
  });

  it("refuses a code that was already used", () => {
    expect(decideVerify({ ...challenge, consumedAt: ago(10) }, "right", now)).toEqual({
      result: "USED",
    });
  });
});
