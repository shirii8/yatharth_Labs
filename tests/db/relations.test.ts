import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSession, findSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { hashPhone } from "@/lib/domain/phone";
import { importLisCsv } from "@/lib/import/service";
import { saveRelations } from "@/lib/patient/relations";
import { MockSmsProvider } from "@/lib/sms/provider";
import { upsertCatalog } from "@/prisma/catalog";

const HEADER =
  "Order ID,Patient,Phone,Age,Sex,Relation,Test Code,Parameter,Result,Reference Range,Status,Referring Doctor,Signed At";
const A = "+919555600001";
const B = "+919555600002";

async function household(phone: string) {
  return db.household.findUniqueOrThrow({
    where: { phoneHash: hashPhone(phone, process.env.PHONE_HASH_KEY!) },
    include: { patients: { orderBy: { name: "asc" } } },
  });
}

async function sessionFor(phone: string, kind: "PATIENT" | "LINK" = "PATIENT") {
  const h = await household(phone);
  const { token } = await createSession({
    kind,
    householdId: h.id,
    ...(kind === "LINK" ? { patientId: h.patients[0]!.id } : {}),
  });
  return (await findSession(token))!;
}

beforeAll(async () => {
  await upsertCatalog(db);
  await importLisCsv(
    {
      fileName: "relations.csv",
      content: [
        HEADER,
        `ORD-REL-1,Asha Rel,${A},44,F,Self,CBC,Haemoglobin,13,12.0-15.5,Ready,,`,
        `ORD-REL-2,Bhanu Rel,${A},70,M,Self,CBC,Haemoglobin,14,13.0-17.0,Ready,,`,
        `ORD-REL-3,Chitra Rel,${A},12,F,Daughter-in-law,CBC,Haemoglobin,13,12.0-15.5,Ready,,`,
        `ORD-REL-4,Other Home,${B},50,F,Self,CBC,Haemoglobin,13,12.0-15.5,Ready,,`,
      ].join("\n"),
    },
    { sms: new MockSmsProvider() },
  );
});
afterAll(() => db.$disconnect());

describe("Who is on this number", () => {
  it("saves each relation, logs every change and marks set-up as done", async () => {
    const session = await sessionFor(A);
    const [asha, bhanu] = (await household(A)).patients;
    const result = await saveRelations(session, [
      { patientId: asha!.id, relation: "Self" },
      { patientId: bhanu!.id, relation: "Father" },
    ]);
    expect(result).toEqual({ ok: true, changed: 1 });

    const after = await household(A);
    expect(after.patients.map((p) => p.relation)).toEqual(["Self", "Father", "Daughter-in-law"]);
    expect(after.setupAt).toBeInstanceOf(Date);
    const logs = await db.accessLog.findMany({
      where: { householdId: after.id, action: "RELATION_CHANGED" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ patientId: bhanu!.id, detail: { from: "Self", to: "Father" } });
  });

  it("keeps a relation the lab typed that is not in the list", async () => {
    const session = await sessionFor(A);
    const chitra = (await household(A)).patients[2]!;
    const result = await saveRelations(session, [
      { patientId: chitra.id, relation: "Daughter-in-law" },
    ]);
    expect(result).toEqual({ ok: true, changed: 0 });
  });

  it("refuses two people marked as the number holder", async () => {
    const session = await sessionFor(A);
    const bhanu = (await household(A)).patients[1]!;
    const result = await saveRelations(session, [{ patientId: bhanu.id, relation: "Self" }]);
    expect(result).toEqual({ ok: false, reason: "TWO_SELF" });
    expect((await household(A)).patients[1]!.relation).toBe("Father");
  });

  it("refuses a word that is not on the list", async () => {
    const session = await sessionFor(A);
    const bhanu = (await household(A)).patients[1]!;
    const result = await saveRelations(session, [{ patientId: bhanu.id, relation: "Boss" }]);
    expect(result).toEqual({ ok: false, reason: "BAD_RELATION" });
  });

  it("never touches a person on another number, and changes nothing else in that request", async () => {
    const session = await sessionFor(A);
    const [asha] = (await household(A)).patients;
    const stranger = (await household(B)).patients[0]!;
    const result = await saveRelations(session, [
      { patientId: asha!.id, relation: "Mother" },
      { patientId: stranger.id, relation: "Sister" },
    ]);
    expect(result).toEqual({ ok: false, reason: "NOT_IN_HOUSEHOLD" });
    expect((await household(A)).patients[0]!.relation).toBe("Self");
    expect((await household(B)).patients[0]!.relation).toBe("Self");
  });

  it("does not let a one-report link change anything", async () => {
    const session = await sessionFor(A, "LINK");
    const [asha] = (await household(A)).patients;
    const result = await saveRelations(session, [{ patientId: asha!.id, relation: "Mother" }]);
    expect(result).toEqual({ ok: false, reason: "NOT_IN_HOUSEHOLD" });
  });
});
