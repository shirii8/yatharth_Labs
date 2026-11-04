import { db } from "@/lib/db/client";
import {
  OTP_TTL_MINUTES,
  RESEND_COOLDOWN_SECONDS,
  decideIssue,
  decideVerify,
  generateOtp,
} from "@/lib/domain/otp";
import { hashPhone, normalisePhone } from "@/lib/domain/phone";
import { hashSecret } from "@/lib/domain/tokens";
import { env } from "@/lib/env";
import { smsProvider, type SmsProvider } from "@/lib/sms/provider";
import { createSession } from "./session";

/**
 * Patient sign-in by mobile number and a 6-digit code. Every code sent, every
 * correct code and every lockout is written to the access log in the same
 * transaction as the change it records.
 */

/** Demo numbers that accept DEMO_OTP, only when DEMO_MODE is on. */
const DEMO_NUMBERS = new Set(["+919000000001", "+919000000002", "+919000000003"]);

interface Deps {
  sms?: SmsProvider;
  now?: () => Date;
  ipHash?: string;
}

export type RequestResult =
  | { ok: true; resendAt: Date }
  | { ok: false; reason: "BAD_PHONE" }
  | { ok: false; reason: "LOCKED" | "COOLDOWN" | "DAILY_CAP"; retryAt: Date };

export async function requestCode(
  input: { phone: string },
  deps: Deps = {},
): Promise<RequestResult> {
  const config = env();
  const now = (deps.now ?? (() => new Date()))();
  const phone = normalisePhone(input.phone);
  if (!phone) return { ok: false, reason: "BAD_PHONE" };

  const phoneHash = hashPhone(phone, config.PHONE_HASH_KEY);
  const recent = await db.otpChallenge.findMany({
    where: { phoneHash, createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60_000) } },
    select: { createdAt: true, lockedUntil: true },
  });
  const demo = Boolean(config.DEMO_MODE && config.DEMO_OTP && DEMO_NUMBERS.has(phone));
  const decision = decideIssue(recent, now);
  // Demo numbers have a fixed code and get no SMS, so many reviewers can sign in a
  // day: only the five-wrong-tries pause still applies to them.
  if (!decision.ok && !(demo && decision.reason !== "LOCKED")) return decision;

  const household = await db.household.findUnique({ where: { phoneHash } });
  const code = demo ? config.DEMO_OTP! : generateOtp();

  await db.$transaction([
    db.otpChallenge.create({
      data: {
        phoneHash,
        codeHash: hashSecret(code, config.TOKEN_HASH_KEY),
        expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60_000),
        ipHash: deps.ipHash,
        createdAt: now,
      },
    }),
    db.accessLog.create({
      data: {
        actorType: "PATIENT",
        action: "OTP_SENT",
        householdId: household?.id,
        ipHash: deps.ipHash,
        detail: { known: Boolean(household) },
      },
    }),
  ]);

  // Only a number on file gets a message. The answer is the same either way,
  // so nobody can use this screen to find out who is a patient.
  if (household) {
    const lab = process.env.NEXT_PUBLIC_LAB_NAME || "Your lab";
    await (deps.sms ?? smsProvider()).send(
      phone,
      `${code} is your ${lab} code. It works for ${OTP_TTL_MINUTES} minutes. Do not share it with anyone, including lab staff.`,
    );
  }

  return { ok: true, resendAt: new Date(now.getTime() + RESEND_COOLDOWN_SECONDS * 1000) };
}

/** For the code screen: is the number paused, and when may another code be sent? */
export async function codeStatus(
  phone: string,
  now: Date = new Date(),
): Promise<{ lockedUntil: Date | null; resendAt: Date | null }> {
  const phoneHash = hashPhone(phone, env().PHONE_HASH_KEY);
  const recent = await db.otpChallenge.findMany({
    where: { phoneHash, createdAt: { gt: new Date(now.getTime() - 24 * 60 * 60_000) } },
    select: { createdAt: true, lockedUntil: true },
  });
  const decision = decideIssue(recent, now);
  if (decision.ok) return { lockedUntil: null, resendAt: null };
  if (decision.reason === "LOCKED") return { lockedUntil: decision.retryAt, resendAt: null };
  return { lockedUntil: null, resendAt: decision.retryAt };
}

export type VerifyResult =
  | { ok: true; token: string; expiresAt: Date; householdId: string }
  | { ok: false; reason: "BAD_PHONE" | "EXPIRED" | "USED" }
  | { ok: false; reason: "WRONG"; attemptsLeft: number }
  | { ok: false; reason: "LOCKED"; lockedUntil: Date };

export async function verifyCode(
  input: { phone: string; code: string },
  deps: Deps = {},
): Promise<VerifyResult> {
  const config = env();
  const now = (deps.now ?? (() => new Date()))();
  const phone = normalisePhone(input.phone);
  if (!phone) return { ok: false, reason: "BAD_PHONE" };

  const phoneHash = hashPhone(phone, config.PHONE_HASH_KEY);
  const challenge = await db.otpChallenge.findFirst({
    where: { phoneHash },
    orderBy: { createdAt: "desc" },
  });
  if (!challenge) return { ok: false, reason: "EXPIRED" };

  const typed = hashSecret(input.code.replace(/\D/g, ""), config.TOKEN_HASH_KEY);
  const decision = decideVerify(challenge, typed, now);
  const household = await db.household.findUnique({ where: { phoneHash } });

  switch (decision.result) {
    case "OK": {
      if (!household) return { ok: false, reason: "WRONG", attemptsLeft: 0 };
      return db.$transaction(async (tx) => {
        await tx.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: now } });
        await tx.accessLog.create({
          data: {
            actorType: "PATIENT",
            action: "OTP_VERIFIED",
            householdId: household.id,
            ipHash: deps.ipHash,
          },
        });
        const session = await createSession(
          { kind: "PATIENT", householdId: household.id, now },
          tx,
        );
        return { ok: true as const, ...session, householdId: household.id };
      });
    }
    case "WRONG":
      await db.$transaction([
        db.otpChallenge.update({
          where: { id: challenge.id },
          data: { attempts: decision.attempts },
        }),
        db.accessLog.create({
          data: {
            actorType: "PATIENT",
            action: "OTP_FAILED",
            householdId: household?.id,
            ipHash: deps.ipHash,
          },
        }),
      ]);
      return { ok: false, reason: "WRONG", attemptsLeft: decision.attemptsLeft };
    case "LOCKED":
      // A new lock (this was the fifth wrong code) is saved and logged once.
      if (decision.attempts !== undefined) {
        await db.$transaction([
          db.otpChallenge.update({
            where: { id: challenge.id },
            data: { attempts: decision.attempts, lockedUntil: decision.lockedUntil },
          }),
          db.accessLog.create({
            data: {
              actorType: "PATIENT",
              action: "OTP_LOCKED",
              householdId: household?.id,
              ipHash: deps.ipHash,
            },
          }),
        ]);
      }
      return { ok: false, reason: "LOCKED", lockedUntil: decision.lockedUntil };
    default:
      return { ok: false, reason: decision.result };
  }
}
