import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hasConsent, reportForSession } from "@/lib/auth/access";
import { createSession, findSession, revokeSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { hashPhone } from "@/lib/domain/phone";
import { importLisCsv } from "@/lib/import/service";
import { MockSmsProvider } from "@/lib/sms/provider";
import { upsertCatalog } from "@/prisma/catalog";

const HEADER =
  "Order ID,Patient,Phone,Age,Sex,Relation,Test Code,Parameter,Result,Reference Range,Status,Referring Doctor,Signed At";
const A = "+919222200001";
const B = "+919222200002";
const now = () => new Date();

async function household(phone: string) {
  return db.household.findUniqueOrThrow({
    where: { phoneHash: hashPhone(phone, process.env.PHONE_HASH_KEY!) },
  });
}
async function report(orderId: string) {
  return db.report.findFirstOrThrow({ where: { orderId } });
}

beforeAll(async () => {
  await upsertCatalog(db);
  await importLisCsv(
    {
      fileName: "access.csv",
      content: [
        HEADER,
        `ORD-A-1,Family A Mother,${A},60,F,Self,CBC,Haemoglobin,13,12.0-15.5,Ready,,`,
        `ORD-A-2,Family A Son,${A},30,M,Son,CBC,Haemoglobin,15,13.0-17.0,Ready,,`,
        `ORD-A-3,Family A Mother,${A},60,F,Self,LIPID,LDL cholesterol,90,0-100,Processing,,`,
        `ORD-B-1,Family B Person,${B},45,M,Self,CBC,Haemoglobin,14,13.0-17.0,Ready,,`,
      ].join("\n"),
    },
    { sms: new MockSmsProvider() },
  );
  for (const phone of [A, B]) {
    const h = await household(phone);
    await db.household.update({
      where: { id: h.id },
      data: { consentAt: new Date(), consentVersion: "v1" },
    });
  }
});
afterAll(() => db.$disconnect());

describe("patient sessions can only reach their own household's reports", () => {
  it("opens a signed report of any family member on the same number", async () => {
    const { token } = await createSession({
      kind: "PATIENT",
      householdId: (await household(A)).id,
    });
    const session = (await findSession(token, now()))!;
    expect(await reportForSession(session, (await report("ORD-A-1")).id)).not.toBeNull();
    expect(await reportForSession(session, (await report("ORD-A-2")).id)).not.toBeNull();
  });

  it("refuses another household's report even with its real ID in the URL", async () => {
    const { token } = await createSession({
      kind: "PATIENT",
      householdId: (await household(A)).id,
    });
    const session = (await findSession(token, now()))!;
    expect(await reportForSession(session, (await report("ORD-B-1")).id)).toBeNull();
  });

  it("refuses a report that is not signed yet", async () => {
    const { token } = await createSession({
      kind: "PATIENT",
      householdId: (await household(A)).id,
    });
    const session = (await findSession(token, now()))!;
    expect(await reportForSession(session, (await report("ORD-A-3")).id)).toBeNull();
  });

  it("refuses every report once consent is withdrawn", async () => {
    const b = await household(B);
    await db.household.update({ where: { id: b.id }, data: { consentWithdrawnAt: new Date() } });
    const { token } = await createSession({ kind: "PATIENT", householdId: b.id });
    const session = (await findSession(token, now()))!;
    expect(hasConsent(await household(B))).toBe(false);
    expect(await reportForSession(session, (await report("ORD-B-1")).id)).toBeNull();
  });
});

describe("link sessions open exactly one report", () => {
  it("opens its own report and nothing else on the same number", async () => {
    const own = await report("ORD-A-1");
    const { token } = await createSession({
      kind: "LINK",
      householdId: (await household(A)).id,
      reportId: own.id,
    });
    const session = (await findSession(token, now()))!;
    expect(await reportForSession(session, own.id)).not.toBeNull();
    expect(await reportForSession(session, (await report("ORD-A-2")).id)).toBeNull();
  });
});

describe("sessions", () => {
  it("are gone once revoked", async () => {
    const { token } = await createSession({
      kind: "PATIENT",
      householdId: (await household(A)).id,
    });
    await revokeSession(token);
    expect(await findSession(token, now())).toBeNull();
  });

  it("time out after 30 minutes without use", async () => {
    const { token } = await createSession({
      kind: "PATIENT",
      householdId: (await household(A)).id,
    });
    const later = new Date(Date.now() + 31 * 60_000);
    expect(await findSession(token, later)).toBeNull();
  });

  it("are never found from a made-up token", async () => {
    expect(await findSession("not-a-real-token", now())).toBeNull();
  });

  it("staff sessions cannot open patient reports", async () => {
    const staff = await db.staffUser.create({
      data: { email: "s@test.lab", name: "S", passwordHash: "x", role: "FRONT_DESK" },
    });
    const { token } = await createSession({ kind: "STAFF", staffUserId: staff.id });
    const session = (await findSession(token, now()))!;
    expect(await reportForSession(session, (await report("ORD-A-1")).id)).toBeNull();
  });
});
