import { familyForSession } from "@/lib/auth/access";
import type { Session } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

export const FAMILY_TINTS = [
  "var(--sky)",
  "var(--rose)",
  "var(--sand)",
  "var(--lilac)",
  "var(--sage)",
];

/**
 * Everyone on the session's number, each with their tab colour and what is
 * waiting: a page to call about, new signed pages, pages still being prepared.
 * "New" means signed and not yet opened by anyone on this number.
 */
export async function familyOverview(session: Session) {
  const family = await familyForSession(session);
  const opened = new Set(
    (
      await db.accessLog.findMany({
        where: { householdId: session.householdId, action: "REPORT_OPENED" },
        select: { reportId: true },
      })
    ).map((l) => l.reportId),
  );

  return family.map((person, i) => {
    const signed = person.reports.filter((r) => r.status === "SIGNED");
    return {
      person,
      tint: FAMILY_TINTS[i % FAMILY_TINTS.length]!,
      call: signed.some((r) => r.hasCritical),
      fresh: signed.filter((r) => !opened.has(r.id)),
      preparing: person.reports.filter((r) => r.status !== "SIGNED"),
      opened,
    };
  });
}

export type FamilyMember = Awaited<ReturnType<typeof familyOverview>>[number];
