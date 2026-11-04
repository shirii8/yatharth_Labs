"use server";

import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentSession, ipHash } from "@/lib/auth/cookies";
import { FLAG_KINDS, raiseFlag } from "@/lib/patient/requests";

const form = z.object({
  kind: z.enum(FLAG_KINDS),
  message: z.string().max(1000),
  reportId: z.string().min(1).max(40),
  patientId: z.string().min(1).max(40),
});

export async function raiseFlagAction(data: FormData): Promise<void> {
  const session = await currentSession();
  if (!session) redirect("/");
  const parsed = form.safeParse({
    kind: data.get("kind"),
    message: data.get("message") ?? "",
    reportId: data.get("reportId"),
    patientId: data.get("patientId"),
  });
  if (!parsed.success) notFound();

  const { kind, message, reportId, patientId } = parsed.data;
  const result = await raiseFlag(session, reportId, { kind, message, ipHash: await ipHash() });
  if (!result.ok) notFound();
  redirect(`/file/${patientId}/${reportId}/flag?ref=${result.reference}`);
}
