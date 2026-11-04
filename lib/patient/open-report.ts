import { reportForSession } from "@/lib/auth/access";
import type { Session } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

/**
 * Opens one report for a patient or link session. Access is checked first
 * (joined through the session's own household), then the opening is written to
 * the access log in the same transaction as the link's open count. If the log
 * cannot be written, the report is not shown.
 */
export async function openReport(
  session: Session,
  reportId: string,
  options: { record: boolean; ipHash?: string },
) {
  const report = await reportForSession(session, reportId);
  if (!report) return null;

  if (options.record) {
    const now = new Date();
    const latestLink = await db.reportLink.findFirst({
      where: { reportId },
      orderBy: { createdAt: "desc" },
    });
    await db.$transaction([
      db.accessLog.create({
        data: {
          actorType: "PATIENT",
          actorId: session.id,
          action: "REPORT_OPENED",
          householdId: session.householdId,
          patientId: report.patientId,
          reportId,
          ipHash: options.ipHash,
          detail: { via: session.kind === "LINK" ? "link" : "sign-in" },
        },
      }),
      ...(latestLink
        ? [
            db.reportLink.update({
              where: { id: latestLink.id },
              data: {
                firstOpenedAt: latestLink.firstOpenedAt ?? now,
                lastOpenedAt: now,
                openCount: { increment: 1 },
              },
            }),
          ]
        : []),
    ]);
  }
  return report;
}

/** The same test for the same person, signed before this one: for the trend line. */
export async function previousReport(report: {
  id: string;
  patientId: string;
  testId: string;
  createdAt: Date;
}) {
  return db.report.findFirst({
    where: {
      patientId: report.patientId,
      testId: report.testId,
      status: "SIGNED",
      hasCritical: false,
      id: { not: report.id },
      createdAt: { lt: report.createdAt },
    },
    orderBy: { createdAt: "desc" },
    include: { results: true },
  });
}
