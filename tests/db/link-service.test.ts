import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reportForSession } from "@/lib/auth/access";
import { checkLink, openLink } from "@/lib/auth/link-service";
import { findSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { importLisCsv } from "@/lib/import/service";
import { MockSmsProvider } from "@/lib/sms/provider";
import { upsertCatalog } from "@/prisma/catalog";

const HEADER =
  "Order ID,Patient,Phone,Age,Sex,Relation,Test Code,Parameter,Result,Reference Range,Status,Referring Doctor,Signed At";
const sms = new MockSmsProvider();
const tokenFor = (name: string) =>
  sms.outbox.find((m) => m.body.includes(name))?.body.match(/\/r\/([A-Za-z0-9_-]{43})/)?.[1] ?? "";

beforeAll(async () => {
  await upsertCatalog(db);
  await importLisCsv(
    {
      fileName: "links.csv",
      content: [
        HEADER,
        "ORD-L-1,Linkone Person,+91 94444 00001,50,F,Self,CBC,Haemoglobin,13,12.0-15.5,Ready,,",
        "ORD-L-2,Linktwo Person,+91 94444 00001,52,M,Husband,CBC,Haemoglobin,15,13.0-17.0,Ready,,",
      ].join("\n"),
    },
    { sms },
  );
});
afterAll(() => db.$disconnect());

describe("report links", () => {
  it("refuses a made-up or cut-off token as invalid", async () => {
    expect(await checkLink("short")).toEqual({ state: "INVALID" });
    expect(await checkLink("A".repeat(43))).toEqual({ state: "INVALID" });
  });

  it("opens a session for exactly the linked report, and logs it", async () => {
    const result = await openLink(tokenFor("Linkone"));
    if (result.state !== "VALID") throw new Error("expected a valid link");
    const session = (await findSession(result.session.token))!;
    expect(session.kind).toBe("LINK");
    expect(await reportForSession(session, result.reportId)).toBeNull(); // consent not given yet
    await db.household.update({
      where: { id: result.householdId },
      data: { consentAt: new Date(), consentVersion: "v1" },
    });
    expect(await reportForSession(session, result.reportId)).not.toBeNull();
    const other = await db.report.findFirstOrThrow({ where: { orderId: "ORD-L-2" } });
    expect(await reportForSession(session, other.id)).toBeNull();
    expect(await db.accessLog.count({ where: { action: "LINK_OPENED" } })).toBe(1);
  });

  it("never lets a link session outlive the link", async () => {
    const link = await db.reportLink.findFirstOrThrow({
      where: { report: { orderId: "ORD-L-1" } },
    });
    const now = new Date(link.expiresAt.getTime() - 5 * 60_000);
    const result = await openLink(tokenFor("Linkone"), undefined, now);
    if (result.state !== "VALID") throw new Error("expected a valid link");
    expect(result.session.expiresAt.getTime()).toBeLessThanOrEqual(link.expiresAt.getTime());
  });

  it("treats a link past 72 hours as expired and logs the attempt", async () => {
    const link = await db.reportLink.findFirstOrThrow({
      where: { report: { orderId: "ORD-L-2" } },
    });
    const result = await openLink(tokenFor("Linktwo"), undefined, link.expiresAt);
    expect(result.state).toBe("EXPIRED");
    expect(await db.accessLog.count({ where: { action: "LINK_EXPIRED" } })).toBe(1);
  });

  it("treats a revoked link as expired, even inside 72 hours", async () => {
    await db.reportLink.updateMany({
      where: { report: { orderId: "ORD-L-2" } },
      data: { revokedAt: new Date() },
    });
    expect((await checkLink(tokenFor("Linktwo"))).state).toBe("EXPIRED");
  });
});
