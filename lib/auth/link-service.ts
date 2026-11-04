import { db } from "@/lib/db/client";
import { hashSecret, isLinkValid } from "@/lib/domain/tokens";
import { env } from "@/lib/env";
import { SESSION_LIMITS, createSession } from "./session";

/**
 * SMS report links. The token in the URL is looked up by its keyed hash. A
 * valid link opens a LINK session for that one report only, for at most two
 * hours and never past the link's own 72 hours. Opening and expired attempts
 * are written to the access log.
 */

export type LinkState =
  | { state: "INVALID" }
  | { state: "EXPIRED"; reportId: string }
  | { state: "VALID"; reportId: string; patientId: string; householdId: string; expiresAt: Date };

export async function checkLink(token: string, now: Date = new Date()): Promise<LinkState> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { state: "INVALID" };
  const link = await db.reportLink.findUnique({
    where: { tokenHash: hashSecret(token, env().TOKEN_HASH_KEY) },
    include: { report: { include: { patient: true } } },
  });
  if (!link || link.report.status !== "SIGNED") return { state: "INVALID" };
  if (!isLinkValid(link, now)) return { state: "EXPIRED", reportId: link.reportId };
  return {
    state: "VALID",
    reportId: link.reportId,
    patientId: link.report.patientId,
    householdId: link.report.patient.householdId,
    expiresAt: link.expiresAt,
  };
}

export async function openLink(token: string, ipHash?: string, now: Date = new Date()) {
  const link = await checkLink(token, now);
  if (link.state === "INVALID") return link;
  if (link.state === "EXPIRED") {
    await db.accessLog.create({
      data: { actorType: "PATIENT", action: "LINK_EXPIRED", reportId: link.reportId, ipHash },
    });
    return link;
  }

  const session = await db.$transaction(async (tx) => {
    const created = await createSession(
      {
        kind: "LINK",
        householdId: link.householdId,
        reportId: link.reportId,
        patientId: link.patientId,
        now,
      },
      tx,
    );
    // A link session never outlives the link itself.
    const cap = Math.min(
      created.expiresAt.getTime(),
      now.getTime() + SESSION_LIMITS.LINK.maxMinutes * 60_000,
      link.expiresAt.getTime(),
    );
    await tx.accessLog.create({
      data: {
        actorType: "PATIENT",
        action: "LINK_OPENED",
        householdId: link.householdId,
        patientId: link.patientId,
        reportId: link.reportId,
        ipHash,
      },
    });
    return { ...created, expiresAt: new Date(cap) };
  });
  return { ...link, session };
}
