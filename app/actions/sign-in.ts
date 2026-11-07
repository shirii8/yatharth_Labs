"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  clearPendingPhone,
  ipHash,
  pendingPhone,
  setPendingPhone,
  setSessionCookie,
} from "@/lib/auth/cookies";
import { requestCode, verifyCode } from "@/lib/auth/otp-service";
import { db } from "@/lib/db/client";
import { normalisePhone } from "@/lib/domain/phone";

export type SendState = {
  error?: "BAD_PHONE" | "COOLDOWN" | "DAILY_CAP" | "LOCKED";
  retryAt?: string;
};

const phoneForm = z.object({ phone: z.string().trim().min(1).max(20) });

/** Step 1: send a code. The same answer for every valid number, known or not. */
export async function sendCodeAction(_prev: SendState, form: FormData): Promise<SendState> {
  const parsed = phoneForm.safeParse({ phone: form.get("phone") });
  const phone = parsed.success ? normalisePhone(parsed.data.phone) : null;
  if (!phone) return { error: "BAD_PHONE" };

  const result = await requestCode({ phone }, { ipHash: await ipHash() });
  if (!result.ok && result.reason !== "BAD_PHONE" && result.reason !== "COOLDOWN") {
    return { error: result.reason, retryAt: result.retryAt.toISOString() };
  }
  // A cooldown on the first screen means a code is already on its way: go to it.
  await setPendingPhone(phone);
  redirect("/code");
}

export type VerifyState = {
  error?: "WRONG" | "EXPIRED" | "USED" | "BAD_CODE";
  attemptsLeft?: number;
};

const codeForm = z.object({ code: z.string().regex(/^\d{6}$/) });

/** Step 2: check the code, open a session, then go to consent or the family file. */
export async function verifyCodeAction(_prev: VerifyState, form: FormData): Promise<VerifyState> {
  const phone = await pendingPhone();
  if (!phone) redirect("/?expired=1");

  const digits = [1, 2, 3, 4, 5, 6].map((i) => String(form.get(`d${i}`) ?? "")).join("");
  const parsed = codeForm.safeParse({ code: digits.replace(/\D/g, "") });
  if (!parsed.success) return { error: "BAD_CODE" };

  const result = await verifyCode({ phone, code: parsed.data.code }, { ipHash: await ipHash() });
  if (!result.ok) {
    if (result.reason === "LOCKED") redirect("/code?locked=1");
    if (result.reason === "WRONG") return { error: "WRONG", attemptsLeft: result.attemptsLeft };
    if (result.reason === "BAD_PHONE") redirect("/");
    return { error: result.reason };
  }

  await setSessionCookie(result.token, result.expiresAt);
  await clearPendingPhone();
  const household = await db.household.findUniqueOrThrow({ where: { id: result.householdId } });
  if (!household.consentAt || household.consentWithdrawnAt) redirect("/consent");
  if (!household.readingMode) redirect("/preference");
  if (!household.setupAt) redirect("/setup");
  redirect("/family");
}

/** "Send another": the same rules as the first code, including the 60 second wait. */
export async function resendCodeAction(): Promise<void> {
  const phone = await pendingPhone();
  if (!phone) redirect("/");
  const result = await requestCode({ phone }, { ipHash: await ipHash() });
  if (!result.ok && result.reason === "LOCKED") redirect("/code?locked=1");
  redirect("/code?sent=1");
}
