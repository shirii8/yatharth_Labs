import { randomInt } from "node:crypto";
import { safeEqual } from "./tokens";

/**
 * One-time codes for patient sign-in. Numbers from the brief: a code lasts
 * 10 minutes, 5 wrong tries pause the number for 15 minutes, and a resend waits
 * 60 seconds. The daily cap of 5 codes is our assumption (A19).
 */
export const OTP_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export const RESEND_COOLDOWN_SECONDS = 60;
export const DAILY_CAP = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Six digits from a cryptographic source. Leading zeros are kept. */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export type IssueDecision =
  { ok: true } | { ok: false; reason: "LOCKED" | "COOLDOWN" | "DAILY_CAP"; retryAt: Date };

/** May a new code be sent? `recent` is this number's challenges, any order. */
export function decideIssue(
  recent: { createdAt: Date; lockedUntil: Date | null }[],
  now: Date,
): IssueDecision {
  const t = now.getTime();

  const lock = recent
    .map((c) => c.lockedUntil)
    .filter((d): d is Date => d !== null && d.getTime() > t)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  if (lock) return { ok: false, reason: "LOCKED", retryAt: lock };

  const times = recent.map((c) => c.createdAt.getTime()).sort((a, b) => b - a);
  const latest = times[0];
  if (latest !== undefined && t - latest < RESEND_COOLDOWN_SECONDS * 1000) {
    return {
      ok: false,
      reason: "COOLDOWN",
      retryAt: new Date(latest + RESEND_COOLDOWN_SECONDS * 1000),
    };
  }

  const today = times.filter((ms) => t - ms < DAY_MS);
  if (today.length >= DAILY_CAP) {
    const oldest = today[today.length - 1]!;
    return { ok: false, reason: "DAILY_CAP", retryAt: new Date(oldest + DAY_MS) };
  }

  return { ok: true };
}

export type VerifyDecision =
  | { result: "OK" }
  | { result: "WRONG"; attempts: number; attemptsLeft: number }
  | { result: "LOCKED"; attempts?: number; lockedUntil: Date }
  | { result: "EXPIRED" }
  | { result: "USED" };

/** Checks a typed code (already hashed) against the latest challenge. */
export function decideVerify(
  challenge: {
    codeHash: string;
    attempts: number;
    expiresAt: Date;
    consumedAt: Date | null;
    lockedUntil: Date | null;
  },
  typedHash: string,
  now: Date,
): VerifyDecision {
  const t = now.getTime();
  if (challenge.lockedUntil && challenge.lockedUntil.getTime() > t) {
    return { result: "LOCKED", lockedUntil: challenge.lockedUntil };
  }
  if (challenge.consumedAt) return { result: "USED" };
  if (t >= challenge.expiresAt.getTime()) return { result: "EXPIRED" };

  if (safeEqual(challenge.codeHash, typedHash)) return { result: "OK" };

  const attempts = challenge.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    return { result: "LOCKED", attempts, lockedUntil: new Date(t + LOCK_MINUTES * 60_000) };
  }
  return { result: "WRONG", attempts, attemptsLeft: MAX_ATTEMPTS - attempts };
}
