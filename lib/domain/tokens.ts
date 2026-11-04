import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** The brief: links expire in 72 hours and need an OTP to reopen. */
export const LINK_TTL_HOURS = 72;

/** 32 random bytes as base64url: 256 bits, safe to put in a URL. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * HMAC-SHA256 of a secret (link token, OTP code, session token) under a server key.
 * Only this hash is stored, so a copy of the database cannot be replayed.
 */
export function hashSecret(secret: string, key: string): string {
  return createHmac("sha256", key).update(secret).digest("hex");
}

/** Constant-time comparison, so timing cannot reveal how much of a code matched. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function linkExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + LINK_TTL_HOURS * 60 * 60 * 1000);
}

/** Valid until, but not at, the expiry moment, and never after it is revoked. */
export function isLinkValid(
  link: { expiresAt: Date; revokedAt: Date | null },
  now: Date,
): boolean {
  if (link.revokedAt !== null) return false;
  return now.getTime() < link.expiresAt.getTime();
}
