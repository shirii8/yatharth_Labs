"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { currentSession, ipHash } from "@/lib/auth/cookies";
import { requestCallback } from "@/lib/patient/requests";

const form = z.object({
  reason: z.string().max(500).optional(),
  reportId: z.string().max(40).optional(),
});

export async function callBackAction(data: FormData): Promise<void> {
  const session = await currentSession();
  if (!session) redirect("/call-me-back");
  const parsed = form.safeParse({
    reason: data.get("reason") ?? undefined,
    reportId: data.get("reportId") || undefined,
  });
  if (!parsed.success) redirect("/call-me-back");
  await requestCallback(session, { ...parsed.data, ipHash: await ipHash() });
  redirect("/call-me-back?done=1");
}
