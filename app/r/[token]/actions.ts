"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ipHash, setSessionCookie } from "@/lib/auth/cookies";
import { openLink } from "@/lib/auth/link-service";
import { db } from "@/lib/db/client";

const form = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

/** The tap on "Open my page": checks the link again, opens a one-report session. */
export async function openLinkAction(data: FormData): Promise<void> {
  const parsed = form.safeParse({ token: data.get("token") });
  if (!parsed.success) redirect("/notice/invalid");

  const result = await openLink(parsed.data.token, await ipHash());
  if (result.state === "INVALID") redirect("/notice/invalid");
  if (result.state === "EXPIRED") redirect("/notice/expired");

  await setSessionCookie(result.session.token, result.session.expiresAt);
  const household = await db.household.findUniqueOrThrow({ where: { id: result.householdId } });
  if (!household.consentAt || household.consentWithdrawnAt) redirect("/consent");
  redirect(`/file/${result.patientId}/${result.reportId}`);
}
