import type { StaffRole } from "@/lib/auth/roles";
import { db } from "@/lib/db/client";

/**
 * The referring doctor's view: their own patients' reports from the last 90
 * days, in one place (the brief's "Referring doctor view"). A doctor sees the
 * full values, critical ones included, because they are the clinician; they
 * never see a patient's phone number. Every report opened is logged.
 */

export const DOCTOR_WINDOW_DAYS = 90;

type DoctorAccount = { id: string; role: StaffRole; doctorId: string | null };

const include = {
  test: true,
  patient: { select: { name: true, age: true, sex: true } },
  results: { include: { analyte: true }, orderBy: { analyte: { sortOrder: "asc" as const } } },
};

/** Signed in the window, or still being prepared and ordered in the window. */
function ownRecent(doctorId: string, now: Date) {
  const since = new Date(now.getTime() - DOCTOR_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return {
    referringDoctorId: doctorId,
    OR: [
      { status: "SIGNED" as const, signedAt: { gte: since } },
      { status: { not: "SIGNED" as const }, createdAt: { gte: since } },
    ],
  };
}

export async function doctorReports(account: DoctorAccount, opts: { now?: Date; q?: string } = {}) {
  if (account.role !== "DOCTOR" || !account.doctorId) return [];
  const now = opts.now ?? new Date();
  const q = opts.q?.trim();
  return db.report.findMany({
    where: {
      ...ownRecent(account.doctorId, now),
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { patient: { name: { contains: q, mode: "insensitive" as const } } },
                  { orderId: { contains: q, mode: "insensitive" as const } },
                ],
              },
            ],
          }
        : {}),
    },
    include,
    // Critical first, then reports still being prepared, then the newest signed.
    orderBy: [{ hasCritical: "desc" }, { signedAt: { sort: "desc", nulls: "first" } }],
  });
}

/** One report, only if it is this doctor's and recent. Logged when found; refused quietly otherwise. */
export async function doctorReport(
  account: DoctorAccount,
  reportId: string,
  opts: { now?: Date; ipHash?: string } = {},
) {
  if (account.role !== "DOCTOR" || !account.doctorId) return null;
  const now = opts.now ?? new Date();
  const report = await db.report.findFirst({
    where: { id: reportId, ...ownRecent(account.doctorId, now) },
    include: { ...include, referringDoctor: true },
  });
  if (!report) return null;
  await db.accessLog.create({
    data: {
      actorType: "STAFF",
      actorId: account.id,
      action: "DOCTOR_VIEWED_REPORT",
      patientId: report.patientId,
      reportId: report.id,
      ipHash: opts.ipHash,
    },
  });
  return report;
}
