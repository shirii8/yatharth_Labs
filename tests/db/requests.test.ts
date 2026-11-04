import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSession, findSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { hashPhone } from "@/lib/domain/phone";
import { importLisCsv } from "@/lib/import/service";
import { raiseFlag, requestCallback } from "@/lib/patient/requests";
import { MockSmsProvider } from "@/lib/sms/provider";
import { upsertCatalog } from "@/prisma/catalog";

const HEADER =
  "Order ID,Patient,Phone,Age,Sex,Relation,Test Code,Parameter,Result,Reference Range,Status,Referring Doctor,Signed At";
const A = "+919555500001";
const B = "+919555500002";

async function sessionFor(phone: string) {
  const household = await db.household.findUniqueOrThrow({
    where: { phoneHash: hashPhone(phone, process.env.PHONE_HASH_KEY!) },
  });
  await db.household.update({
    where: { id: household.id },
    data: { consentAt: new Date(), consentVersion: "v1" },
  });
  const { token } = await createSession({ kind: "PATIENT", householdId: household.id });
  return (await findSession(token))!;
}

beforeAll(async () => {
  await upsertCatalog(db);
  await importLisCsv(
    {
      fileName: "requests.csv",
      content: [
        HEADER,
        `ORD-Q-1,Request Person,${A},50,F,Self,CBC,Haemoglobin,13,12.0-15.5,Ready,,`,
        `ORD-Q-2,Other Family,${B},50,F,Self,CBC,Haemoglobin,13,12.0-15.5,Ready,,`,
      ].join("\n"),
    },
    { sms: new MockSmsProvider() },
  );
});
afterAll(() => db.$disconnect());

describe("Call me back", () => {
  it("creates a call-back task for staff and logs it in the same step", async () => {
    const session = await sessionFor(A);
    const result = await requestCallback(session, { reason: "About my blood test" });
    expect(result.ok).toBe(true);
    const task = await db.callbackTask.findFirstOrThrow({
      where: { householdId: session.householdId!, type: "CALL_ME_BACK" },
    });
    expect(task).toMatchObject({ status: "OPEN", reason: "About my blood test" });
    expect(
      await db.accessLog.count({
        where: { householdId: session.householdId, action: "CALLBACK_REQUESTED" },
      }),
    ).toBe(1);
  });

  it("does not pile up more than three open requests for one number", async () => {
    const session = await sessionFor(A);
    for (let i = 0; i < 5; i++) await requestCallback(session, {});
    expect(
      await db.callbackTask.count({
        where: { householdId: session.householdId!, type: "CALL_ME_BACK", status: "OPEN" },
      }),
    ).toBe(3);
  });
});

describe("Something looks wrong", () => {
  it("records a flag on the patient's own report for staff", async () => {
    const session = await sessionFor(A);
    const report = await db.report.findFirstOrThrow({ where: { orderId: "ORD-Q-1" } });
    const result = await raiseFlag(session, report.id, {
      kind: "VALUE",
      message: "My haemoglobin was 12.4 at another lab.",
    });
    expect(result.ok).toBe(true);
    const flag = await db.patientFlag.findFirstOrThrow({ where: { reportId: report.id } });
    expect(flag).toMatchObject({ kind: "VALUE", status: "OPEN" });
    expect(
      await db.accessLog.count({ where: { action: "FLAG_RAISED", reportId: report.id } }),
    ).toBe(1);
  });

  it("refuses a flag on another household's report", async () => {
    const session = await sessionFor(A);
    const other = await db.report.findFirstOrThrow({ where: { orderId: "ORD-Q-2" } });
    expect(await raiseFlag(session, other.id, { kind: "OTHER", message: "" })).toEqual({
      ok: false,
    });
    expect(await db.patientFlag.count({ where: { reportId: other.id } })).toBe(0);
  });
});
