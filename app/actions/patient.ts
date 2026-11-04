"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSessionCookie, currentSession, ipHash, sessionToken } from "@/lib/auth/cookies";
import { requirePatient } from "@/lib/auth/guards";
import { revokeSession } from "@/lib/auth/session";
import { CONSENT_VERSION } from "@/lib/consent";
import { db } from "@/lib/db/client";

export type ConsentState = { error?: "MUST_AGREE" };

/** Records consent with its text version and time, logged in the same transaction. */
export async function giveConsentAction(
  _prev: ConsentState,
  form: FormData,
): Promise<ConsentState> {
  const session = await currentSession();
  if (!session?.householdId || session.kind === "STAFF") redirect("/");
  if (form.get("agree") !== "on") return { error: "MUST_AGREE" };

  const householdId = session.householdId;
  const now = new Date();
  await db.$transaction([
    db.household.update({
      where: { id: householdId },
      data: { consentAt: now, consentVersion: CONSENT_VERSION, consentWithdrawnAt: null },
    }),
    db.accessLog.create({
      data: {
        actorType: "PATIENT",
        actorId: session.id,
        action: "CONSENT_GIVEN",
        householdId,
        ipHash: await ipHash(),
        detail: { version: CONSENT_VERSION },
      },
    }),
  ]);

  // Opened from an SMS link: go straight back to that one report.
  if (session.kind === "LINK" && session.reportId && session.patientId) {
    redirect(`/file/${session.patientId}/${session.reportId}`);
  }
  const household = await db.household.findUniqueOrThrow({ where: { id: householdId } });
  redirect(household.readingMode ? "/family" : "/preference");
}

const modeForm = z.object({ mode: z.enum(["SIMPLE", "COMPACT"]) });

export async function setReadingModeAction(form: FormData): Promise<void> {
  const { household } = await requirePatient();
  const parsed = modeForm.safeParse({ mode: form.get("mode") });
  if (!parsed.success) redirect("/preference");
  await db.household.update({
    where: { id: household.id },
    data: { readingMode: parsed.data.mode },
  });
  const back = String(form.get("back") ?? "");
  redirect(back.startsWith("/file/") ? back : "/family");
}

export async function signOutAction(): Promise<void> {
  const token = await sessionToken();
  if (token) await revokeSession(token);
  await clearSessionCookie();
  redirect("/");
}
