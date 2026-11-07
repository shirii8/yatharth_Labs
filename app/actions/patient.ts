"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSessionCookie, currentSession, ipHash, sessionToken } from "@/lib/auth/cookies";
import { requirePatient } from "@/lib/auth/guards";
import { revokeSession } from "@/lib/auth/session";
import { CONSENT_VERSION } from "@/lib/consent";
import { db } from "@/lib/db/client";
import { saveRelations } from "@/lib/patient/relations";

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
  redirect(!household.readingMode ? "/preference" : household.setupAt ? "/family" : "/setup");
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
  // Simple is the easy view: bigger text and fewer buttons on every screen.
  (await cookies()).set("easy", parsed.data.mode === "SIMPLE" ? "on" : "off", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  const back = String(form.get("back") ?? "");
  if (back.startsWith("/file/") || back === "/settings") redirect(back);
  // First time through: the next setup step is who is on this number.
  redirect(household.setupAt ? "/family" : "/setup");
}

/**
 * Withdraws consent for the whole number: reports stop opening, every session
 * on the number ends at once, and no further SMS links are sent. The record of
 * the withdrawal is written in the same transaction.
 */
export async function withdrawConsentAction(form: FormData): Promise<void> {
  const { session, household } = await requirePatient();
  if (form.get("confirm") !== "yes") redirect("/me/data?withdraw=1");
  const now = new Date();
  await db.$transaction([
    db.household.update({ where: { id: household.id }, data: { consentWithdrawnAt: now } }),
    db.session.updateMany({
      where: { householdId: household.id, revokedAt: null },
      data: { revokedAt: now },
    }),
    db.accessLog.create({
      data: {
        actorType: "PATIENT",
        actorId: session.id,
        action: "CONSENT_WITHDRAWN",
        householdId: household.id,
        ipHash: await ipHash(),
      },
    }),
  ]);
  await clearSessionCookie();
  redirect("/notice/withdrawn");
}

/**
 * Saves how each person on the number relates to the number holder. Used by
 * first-time setup ("setup") and by Settings ("settings"). Each select is
 * named "rel:<patient id>"; the rules live in lib/patient/relations.ts.
 */
export async function saveRelationsAction(form: FormData): Promise<void> {
  const { session } = await requirePatient();
  const from = form.get("from") === "setup" ? "setup" : "settings";
  const page = from === "setup" ? "/setup" : "/settings/people";
  const choices = [...form.entries()]
    .filter(([key]) => key.startsWith("rel:"))
    .map(([key, value]) => ({ patientId: key.slice(4), relation: String(value) }));
  const result = await saveRelations(session, choices, { ipHash: await ipHash() });
  if (!result.ok) {
    redirect(`${page}?error=${result.reason === "TWO_SELF" ? "two-self" : "bad"}`);
  }
  redirect(from === "setup" ? "/family" : "/settings/people?saved=1");
}

export async function signOutAction(): Promise<void> {
  const token = await sessionToken();
  if (token) await revokeSession(token);
  await clearSessionCookie();
  redirect("/");
}
