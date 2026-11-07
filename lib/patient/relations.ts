import type { Session } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

/**
 * "Who is on this number": the number holder says how each person on the
 * number relates to them. Only the label changes. Adding or removing people
 * stays with the front desk, so nobody's reports can be hidden or claimed by
 * mistake from a phone.
 */

/** The choices offered on the screen. Stored in English; each screen translates them. */
export const RELATIONS = [
  "Self",
  "Spouse",
  "Mother",
  "Father",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Grandmother",
  "Grandfather",
  "Grandchild",
  "Other family",
] as const;

export type RelationChoice = { patientId: string; relation: string };

export type RelationResult =
  | { ok: true; changed: number }
  | { ok: false; reason: "NOT_IN_HOUSEHOLD" | "BAD_RELATION" | "TWO_SELF" };

const isSelf = (relation: string) => relation.trim().toLowerCase() === "self";

export async function saveRelations(
  session: Session,
  choices: RelationChoice[],
  opts: { ipHash?: string; now?: Date } = {},
): Promise<RelationResult> {
  // A one-report link never changes the file; only a full sign-in does.
  if (session.kind !== "PATIENT" || !session.householdId) {
    return { ok: false, reason: "NOT_IN_HOUSEHOLD" };
  }
  const householdId = session.householdId;
  const people = await db.patient.findMany({ where: { householdId } });
  const byId = new Map(people.map((p) => [p.id, p]));

  // Every id must belong to this number, or nothing is saved.
  if (choices.some((c) => !byId.has(c.patientId))) {
    return { ok: false, reason: "NOT_IN_HOUSEHOLD" };
  }
  // A word from the list, or the one the lab already typed for this person.
  const allowed = (c: RelationChoice) =>
    (RELATIONS as readonly string[]).includes(c.relation) ||
    c.relation === byId.get(c.patientId)!.relation;
  if (!choices.every(allowed)) return { ok: false, reason: "BAD_RELATION" };

  const next = new Map(people.map((p) => [p.id, p.relation]));
  for (const c of choices) next.set(c.patientId, c.relation);
  if ([...next.values()].filter(isSelf).length > 1) return { ok: false, reason: "TWO_SELF" };

  const changes = choices.filter((c) => byId.get(c.patientId)!.relation !== c.relation);
  const now = opts.now ?? new Date();
  await db.$transaction([
    ...changes.map((c) =>
      db.patient.update({ where: { id: c.patientId }, data: { relation: c.relation } }),
    ),
    ...changes.map((c) =>
      db.accessLog.create({
        data: {
          at: now,
          actorType: "PATIENT",
          actorId: session.id,
          action: "RELATION_CHANGED",
          householdId,
          patientId: c.patientId,
          ipHash: opts.ipHash,
          detail: { from: byId.get(c.patientId)!.relation, to: c.relation },
        },
      }),
    ),
    db.household.updateMany({
      where: { id: householdId, setupAt: null },
      data: { setupAt: now },
    }),
  ]);
  return { ok: true, changed: changes.length };
}
