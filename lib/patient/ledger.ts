import { db } from "@/lib/db/client";

/**
 * The access record as a patient reads it: who opened what, and when, in plain
 * words. Staff views of the file appear too; that is the point of the record.
 */

const WORDS: Record<string, string> = {
  OTP_SENT: "A sign-in code was sent",
  OTP_VERIFIED: "Signed in with a code",
  OTP_FAILED: "A wrong code was typed",
  OTP_LOCKED: "Sign-in paused after 5 wrong codes",
  LINK_SENT: "A link to a new page was sent by SMS",
  LINK_RESENT: "The front desk sent a new link",
  LINK_OPENED: "A page was opened from an SMS link",
  LINK_EXPIRED: "An old link was tried after it closed",
  REPORT_OPENED: "A page was read",
  REPORT_PDF_DOWNLOADED: "The signed report was downloaded",
  CONSENT_GIVEN: "You agreed to the four promises",
  CONSENT_WITHDRAWN: "Consent was withdrawn",
  CALLBACK_REQUESTED: "You asked for a call back",
  FLAG_RAISED: "You told us something looked wrong",
  STAFF_VIEWED_PATIENT: "Lab staff looked at this file",
  STAFF_VIEWED_PHONE: "Lab staff looked up the full number",
};

export async function ledgerFor(householdId: string, take = 40) {
  const rows = await db.accessLog.findMany({
    where: { householdId, action: { in: Object.keys(WORDS) as never } },
    orderBy: { at: "desc" },
    take,
  });
  const reportIds = [...new Set(rows.map((r) => r.reportId).filter((x): x is string => !!x))];
  const reports = await db.report.findMany({
    where: { id: { in: reportIds } },
    include: { test: true, patient: true },
  });
  const byId = new Map(reports.map((r) => [r.id, r]));

  return rows.map((row) => {
    const report = row.reportId ? byId.get(row.reportId) : undefined;
    return {
      id: String(row.id),
      at: row.at,
      words: WORDS[row.action] ?? row.action,
      about: report ? `${report.test.name}, ${report.patient.name}` : null,
      byStaff: row.actorType === "STAFF",
    };
  });
}
