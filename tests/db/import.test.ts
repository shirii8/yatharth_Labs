import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { hashSecret } from "@/lib/domain/tokens";
import { importLisCsv } from "@/lib/import/service";
import { MockSmsProvider } from "@/lib/sms/provider";
import { upsertCatalog } from "@/prisma/catalog";

const SAMPLE = readFileSync("samples/lis-export-2026-11-04.csv", "utf8");
const HEADER = SAMPLE.split("\n")[0];

beforeAll(() => upsertCatalog(db));
afterAll(() => db.$disconnect());

function reportFor(orderId: string) {
  return db.report.findFirstOrThrow({
    where: { orderId },
    include: { results: { include: { analyte: true } }, links: true, callbackTasks: true },
  });
}

describe("importLisCsv with the brief's sample orders", () => {
  const sms = new MockSmsProvider();

  it("imports every row of the sample file", async () => {
    const result = await importLisCsv({ fileName: "sample.csv", content: SAMPLE }, { sms });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totalRows).toBe(12);
    expect(result.errorRows).toBe(0);
    expect(result.importedRows).toBe(12);
  });

  it("flags Lakshmi's haemoglobin LOW by rule and sends her one link", async () => {
    const report = await reportFor("ORD-71204");
    expect(report.status).toBe("SIGNED");
    const hb = report.results.find((r) => r.analyte.code === "HB");
    expect(hb).toMatchObject({ value: 10.2, valueText: "10.2", flag: "LOW", isCritical: false });
    expect(report.links).toHaveLength(1);
    expect(report.links[0]?.deliveryStatus).toBe("DELIVERED");
  });

  it("puts a working token in the SMS and stores only its hash", async () => {
    const report = await reportFor("ORD-71204");
    const link = report.links[0]!;
    const message = sms.outbox.find((m) => m.to === "+919000000001" && m.body.includes("Lakshmi"));
    const token = message?.body.match(/\/r\/([A-Za-z0-9_-]{43})/)?.[1];
    expect(token).toBeDefined();
    expect(link.tokenHash).toBe(hashSecret(token!, process.env.TOKEN_HASH_KEY!));
    expect(link.tokenHash).not.toContain(token!);
  });

  it("keeps Venkata's Processing lipid report unsigned, with no link", async () => {
    const report = await reportFor("ORD-71219");
    expect(report.status).toBe("TESTED");
    expect(report.links).toHaveLength(0);
  });

  it("marks Farzana's potassium critical and queues one critical call", async () => {
    const report = await reportFor("ORD-71233");
    expect(report.hasCritical).toBe(true);
    expect(report.results.find((r) => r.analyte.code === "K")?.isCritical).toBe(true);
    expect(report.callbackTasks).toHaveLength(1);
    expect(report.callbackTasks[0]).toMatchObject({ type: "CRITICAL", status: "OPEN" });
    expect(report.links).toHaveLength(1);
  });

  it("never puts a result value in the SMS", async () => {
    for (const message of sms.outbox) {
      expect(message.body).not.toMatch(/6\.8|10\.2|142/);
    }
  });

  it("puts a whole family on one number, stored encrypted", async () => {
    const households = await db.household.findMany({ include: { patients: true } });
    const lakshmi = households.find((h) => h.patients.some((p) => p.name === "Lakshmi Prasanna K"));
    expect(lakshmi?.patients.map((p) => p.name).sort()).toEqual([
      "Anjali K",
      "Lakshmi Prasanna K",
      "Ramana Rao K",
    ]);
    expect(lakshmi?.phoneMasked).toBe("+91 ••••• •0001");
    expect(lakshmi?.phoneCipher).not.toContain("9000000001");
  });

  it("writes LINK_SENT to the access log for every link", async () => {
    const links = await db.reportLink.count();
    const logged = await db.accessLog.count({ where: { action: "LINK_SENT" } });
    expect(logged).toBe(links);
  });

  it("changes nothing when the same file is uploaded again", async () => {
    const count = async () => ({
      reports: await db.report.count(),
      results: await db.result.count(),
      links: await db.reportLink.count(),
      tasks: await db.callbackTask.count(),
      sent: sms.outbox.length,
    });
    const before = await count();
    const again = await importLisCsv({ fileName: "sample.csv", content: SAMPLE }, { sms });
    expect(again.ok && again.unchangedRows).toBe(12);
    expect(await count()).toEqual(before);
  });
});

describe("importLisCsv with bad rows and later sign-off", () => {
  const sms = new MockSmsProvider();

  it("imports the good rows and records each bad row with a sentence", async () => {
    const content = [
      HEADER,
      "ORD-90001,Test Person A,+91 90000 00009,40,F,Self,CBC,Haemoglobin,13.1,12.0-15.5,Ready,,",
      "ORD-90002,Test Person B,900000001,40,F,Self,CBC,Haemoglobin,13.1,12.0-15.5,Ready,,",
      "ORD-90003,Test Person C,+91 90000 00009,40,F,Self,XYZ,Haemoglobin,13.1,12.0-15.5,Ready,,",
    ].join("\n");
    const result = await importLisCsv({ fileName: "mixed.csv", content }, { sms });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.importedRows).toBe(1);
    expect(result.errorRows).toBe(2);
    const rows = await db.importRow.findMany({
      where: { batchId: result.batchId, status: "ERROR" },
      orderBy: { rowNumber: "asc" },
    });
    expect(rows.map((r) => r.rowNumber)).toEqual([3, 4]);
    expect(rows[0]?.error).toMatch(/10-digit Indian mobile/);
    expect(rows[1]?.error).toMatch(/test code "XYZ"/);
  });

  it("refuses a file without the required columns, in one sentence", async () => {
    const result = await importLisCsv(
      { fileName: "bad.csv", content: "Order ID,Patient\nA,B" },
      { sms },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fileError).toMatch(/missing these columns: Phone/);
  });

  it("sends the link only when a Processing report later arrives as Ready", async () => {
    const processing = `${HEADER}\nORD-90010,Test Person D,+91 90000 00008,50,M,Self,LIPID,LDL cholesterol,120,0-100,Processing,,`;
    await importLisCsv({ fileName: "p.csv", content: processing }, { sms });
    expect((await reportFor("ORD-90010")).links).toHaveLength(0);

    const ready = processing.replace("Processing", "Ready");
    await importLisCsv({ fileName: "r.csv", content: ready }, { sms });
    const report = await reportFor("ORD-90010");
    expect(report.status).toBe("SIGNED");
    expect(report.links).toHaveLength(1);
    expect(report.results[0]?.flag).toBe("HIGH");
  });

  it("never moves a signed report back to Processing", async () => {
    const late = `${HEADER}\nORD-90010,Test Person D,+91 90000 00008,50,M,Self,LIPID,LDL cholesterol,120,0-100,Processing,,`;
    await importLisCsv({ fileName: "late.csv", content: late }, { sms });
    expect((await reportFor("ORD-90010")).status).toBe("SIGNED");
  });
});
