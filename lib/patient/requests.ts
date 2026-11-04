import { reportForSession } from "@/lib/auth/access";
import type { Session } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

/**
 * What a patient can ask of the lab: a call back, or a check of a report that
 * looks wrong. Each creates work for staff and an access-log line in the same
 * transaction, so the record and the request can never disagree.
 */

/** More open requests than this from one number add nothing; staff will already call. */
const MAX_OPEN_CALLBACKS = 3;
const CALL_WITHIN_HOURS = 2;

export async function requestCallback(
  session: Session,
  input: { reason?: string; reportId?: string; ipHash?: string },
): Promise<{ ok: boolean }> {
  if (!session.householdId || session.kind === "STAFF") return { ok: false };
  const householdId = session.householdId;

  // A report is attached only if this session may open it.
  const report = input.reportId ? await reportForSession(session, input.reportId) : null;

  const open = await db.callbackTask.count({
    where: { householdId, type: "CALL_ME_BACK", status: "OPEN" },
  });
  if (open >= MAX_OPEN_CALLBACKS) return { ok: true };

  const now = new Date();
  await db.$transaction([
    db.callbackTask.create({
      data: {
        type: "CALL_ME_BACK",
        householdId,
        patientId: report?.patientId ?? session.patientId,
        reportId: report?.id,
        reason: input.reason?.trim() || null,
        dueAt: new Date(now.getTime() + CALL_WITHIN_HOURS * 60 * 60_000),
      },
    }),
    db.accessLog.create({
      data: {
        actorType: "PATIENT",
        actorId: session.id,
        action: "CALLBACK_REQUESTED",
        householdId,
        reportId: report?.id,
        ipHash: input.ipHash,
      },
    }),
  ]);
  return { ok: true };
}

export const FLAG_KINDS = ["NOT_MINE", "NAME_AGE", "VALUE", "OTHER"] as const;
export type FlagKind = (typeof FLAG_KINDS)[number];

export async function raiseFlag(
  session: Session,
  reportId: string,
  input: { kind: FlagKind | string; message: string; ipHash?: string },
): Promise<{ ok: true; reference: string } | { ok: false }> {
  const report = await reportForSession(session, reportId);
  if (!report) return { ok: false };

  const flag = await db.$transaction(async (tx) => {
    const created = await tx.patientFlag.create({
      data: {
        reportId,
        patientId: report.patientId,
        kind: input.kind,
        message: input.message.trim().slice(0, 1000),
      },
    });
    await tx.accessLog.create({
      data: {
        actorType: "PATIENT",
        actorId: session.id,
        action: "FLAG_RAISED",
        householdId: session.householdId,
        patientId: report.patientId,
        reportId,
        ipHash: input.ipHash,
        detail: { flagId: created.id, kind: input.kind },
      },
    });
    return created;
  });
  return { ok: true, reference: flag.id.slice(-6).toUpperCase() };
}
