import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkLink } from "@/lib/auth/link-service";
import { db } from "@/lib/db/client";
import { importLisCsv } from "@/lib/import/service";
import { resendLink } from "@/lib/staff/resend";
import { MockSmsProvider } from "@/lib/sms/provider";
import { upsertCatalog } from "@/prisma/catalog";

const HEADER =
  "Order ID,Patient,Phone,Age,Sex,Relation,Test Code,Parameter,Result,Reference Range,Status,Referring Doctor,Signed At";
const sms = new MockSmsProvider();
const tokens = (name: string) =>
  sms.outbox
    .filter((m) => m.body.includes(name))
    .map((m) => m.body.match(/\/r\/([A-Za-z0-9_-]{43})/)?.[1] ?? "");

let staffId = "";

beforeAll(async () => {
  await upsertCatalog(db);
  const staff = await db.staffUser.create({
    data: { email: "resend@test.lab", name: "Resend", passwordHash: "x", role: "FRONT_DESK" },
  });
  staffId = staff.id;
  await importLisCsv(
    {
      fileName: "resend.csv",
      content: [
        HEADER,
        "ORD-R-1,Resendone Person,+91 96666 00001,50,F,Self,CBC,Haemoglobin,13,12.0-15.5,Ready,,",
        "ORD-R-2,Resendone Person,+91 96666 00001,50,F,Self,LIPID,LDL cholesterol,90,0-100,Processing,,",
      ].join("\n"),
    },
    { sms },
  );
});
afterAll(() => db.$disconnect());

describe("resendLink", () => {
  it("revokes the old link, sends a new one, and logs who did it", async () => {
    const report = await db.report.findFirstOrThrow({ where: { orderId: "ORD-R-1" } });
    const [oldToken] = tokens("Resendone");
    const result = await resendLink(report.id, staffId, { sms });
    expect(result.ok).toBe(true);

    const [, newToken] = tokens("Resendone");
    expect(newToken).toBeDefined();
    expect(newToken).not.toBe(oldToken);
    expect((await checkLink(oldToken!)).state).toBe("EXPIRED");
    expect((await checkLink(newToken!)).state).toBe("VALID");

    const log = await db.accessLog.findFirstOrThrow({
      where: { action: "LINK_RESENT", reportId: report.id },
    });
    expect(log).toMatchObject({ actorType: "STAFF", actorId: staffId });
    const newest = await db.reportLink.findFirstOrThrow({
      where: { reportId: report.id },
      orderBy: { createdAt: "desc" },
    });
    expect(newest).toMatchObject({ createdById: staffId, deliveryStatus: "DELIVERED" });
  });

  it("refuses to send a link for a report that is not signed", async () => {
    const report = await db.report.findFirstOrThrow({ where: { orderId: "ORD-R-2" } });
    expect(await resendLink(report.id, staffId, { sms })).toEqual({
      ok: false,
      reason: "NOT_SIGNED",
    });
  });
});
