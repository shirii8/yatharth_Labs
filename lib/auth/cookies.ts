import { cookies, headers } from "next/headers";
import { decryptPhone, encryptPhone } from "@/lib/domain/phone";
import { hashSecret } from "@/lib/domain/tokens";
import { env } from "@/lib/env";
import { findSession, type Session } from "./session";

/**
 * Cookie helpers for server components and server actions. Every cookie is
 * httpOnly, SameSite=Lax and Secure in production, so scripts cannot read it
 * and other sites cannot send it with a form post.
 */

export const SESSION_COOKIE = "yt_session";
const PENDING_PHONE_COOKIE = "yt_phone";

const base = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, { ...base(), expires: expiresAt });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** The current session of any kind, or null. */
export async function currentSession(): Promise<Session | null> {
  const token = await sessionToken();
  return token ? findSession(token) : null;
}

/** The number a code was just sent to, kept encrypted on the patient's own device. */
export async function setPendingPhone(phone: string) {
  (await cookies()).set(PENDING_PHONE_COOKIE, encryptPhone(phone, env().PHONE_ENC_KEY), {
    ...base(),
    maxAge: 15 * 60,
  });
}

export async function pendingPhone(): Promise<string | null> {
  const value = (await cookies()).get(PENDING_PHONE_COOKIE)?.value;
  if (!value) return null;
  try {
    return decryptPhone(value, env().PHONE_ENC_KEY);
  } catch {
    return null;
  }
}

export async function clearPendingPhone() {
  (await cookies()).delete(PENDING_PHONE_COOKIE);
}

/** A keyed hash of the caller's IP: enough to spot abuse, not enough to identify anyone. */
export async function ipHash(): Promise<string | undefined> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || undefined;
  return ip ? hashSecret(ip, env().TOKEN_HASH_KEY) : undefined;
}
