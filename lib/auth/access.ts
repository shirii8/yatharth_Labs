import { db } from "@/lib/db/client";
import type { Session } from "./session";

/**
 * Access control for patient data. Every report read goes through here. The
 * report is found by joining through the session's own household, so an ID
 * typed into the URL can never reach another family's report (IDOR).
 */

export function hasConsent(household: {
  consentAt: Date | null;
  consentWithdrawnAt: Date | null;
}): boolean {
  return household.consentAt !== null && household.consentWithdrawnAt === null;
}

const reportInclude = {
  test: true,
  patient: true,
  referringDoctor: true,
  results: { include: { analyte: true }, orderBy: { analyte: { sortOrder: "asc" as const } } },
};

/** A signed report this session may open, or null. Never throws on a bad ID. */
export async function reportForSession(session: Session, reportId: string) {
  if (session.kind === "STAFF" || !session.householdId) return null;
  if (session.kind === "LINK" && session.reportId !== reportId) return null;

  const household = await db.household.findUnique({ where: { id: session.householdId } });
  if (!household) return null;
  // A link session may show the consent screen first; a full session needs consent.
  if (session.kind === "PATIENT" && !hasConsent(household)) return null;
  if (household.consentWithdrawnAt) return null;

  return db.report.findFirst({
    where: { id: reportId, status: "SIGNED", patient: { householdId: session.householdId } },
    include: reportInclude,
  });
}

/** Family members on the session's number, with their reports, newest first. */
export async function familyForSession(session: Session) {
  if (session.kind !== "PATIENT" || !session.householdId) return [];
  return db.patient.findMany({
    where: { householdId: session.householdId },
    orderBy: { createdAt: "asc" },
    include: {
      reports: {
        orderBy: { createdAt: "desc" },
        include: { test: true, links: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });
}

/** One family member, only if they are on the session's number. */
export async function patientForSession(session: Session, patientId: string) {
  if (session.kind !== "PATIENT" || !session.householdId) return null;
  return db.patient.findFirst({
    where: { id: patientId, householdId: session.householdId },
    include: {
      reports: {
        orderBy: { createdAt: "desc" },
        include: { test: true, links: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });
}
