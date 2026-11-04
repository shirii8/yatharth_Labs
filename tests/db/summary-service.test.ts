import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AiFacts } from "@/lib/ai/checker";
import type { SummaryWriter } from "@/lib/ai/provider";
import { db } from "@/lib/db/client";
import { importLisCsv } from "@/lib/import/service";
import { MockSmsProvider } from "@/lib/sms/provider";
import { upsertDefaultTemplates } from "@/lib/summary/seed-templates";
import { summaryForReport } from "@/lib/summary/service";
import { upsertCatalog } from "@/prisma/catalog";

const HEADER =
  "Order ID,Patient,Phone,Age,Sex,Relation,Test Code,Parameter,Result,Reference Range,Status,Referring Doctor,Signed At";

class FakeWriter implements SummaryWriter {
  readonly model = "fake-model";
  calls: AiFacts[] = [];
  constructor(private readonly reply: (facts: AiFacts) => string) {}
  async write(facts: AiFacts) {
    this.calls.push(facts);
    return this.reply(facts);
  }
  async translate(text: string) {
    return text;
  }
}

const goodWriter = () =>
  new FakeWriter(
    () =>
      "Your LDL cholesterol is much higher than usual at 138, against a usual range up to 100. Your doctor will explain what this means for you.",
  );

async function report(orderId: string) {
  return db.report.findFirstOrThrow({
    where: { orderId },
    include: {
      test: true,
      patient: true,
      results: { include: { analyte: true }, orderBy: { analyte: { sortOrder: "asc" } } },
    },
  });
}

beforeAll(async () => {
  await upsertCatalog(db);
  await upsertDefaultTemplates(db);
  await importLisCsv(
    {
      fileName: "summary.csv",
      content: [
        HEADER,
        "ORD-S-CBC,Summary Person,+91 93333 00001,60,F,Self,CBC,Haemoglobin,10.2,12.0-15.5,Ready,,",
        "ORD-S-LDL1,Summary Person,+91 93333 00001,60,F,Self,LIPID,LDL cholesterol,138,0-100,Ready,,",
        "ORD-S-LDL2,Summary Person,+91 93333 00001,60,F,Self,LIPID,LDL cholesterol,141,0-100,Ready,,",
        "ORD-S-LDL3,Summary Person,+91 93333 00001,60,F,Self,LIPID,LDL cholesterol,139,0-100,Ready,,",
        "ORD-S-K,Summary Person,+91 93333 00001,60,F,Self,ELEC,Potassium,6.8,3.5-5.1,Ready (critical),,",
      ].join("\n"),
    },
    { sms: new MockSmsProvider() },
  );
});
afterAll(() => db.$disconnect());

describe("summaryForReport", () => {
  it("uses only the locked templates for a locked test, with no AI call", async () => {
    const writer = goodWriter();
    const out = await summaryForReport(await report("ORD-S-CBC"), "en", { writer });
    expect(writer.calls).toHaveLength(0);
    expect(out.ai).toBeNull();
    expect(out.summary.kind === "RESULTS" && out.summary.intro).toBe(
      "Haemoglobin is a little low.",
    );
  });

  it("never calls the AI for a critical report and shows no values", async () => {
    const writer = goodWriter();
    const out = await summaryForReport(await report("ORD-S-K"), "en", { writer });
    expect(out.summary).toEqual({ kind: "CRITICAL" });
    expect(writer.calls).toHaveLength(0);
  });

  it("shows a checked AI summary for an unlocked test and keeps it for review", async () => {
    const writer = goodWriter();
    const r = await report("ORD-S-LDL1");
    const out = await summaryForReport(r, "en", { writer });
    expect(out.ai?.text).toMatch(/much higher than usual/);
    const stored = await db.aiSummary.findFirstOrThrow({ where: { reportId: r.id } });
    expect(stored).toMatchObject({ status: "SHOWN", model: "fake-model" });
  });

  it("sends the AI only the rule's findings, never who the patient is", async () => {
    const writer = goodWriter();
    await summaryForReport(await report("ORD-S-LDL3"), "en", { writer });
    const sent = JSON.stringify(writer.calls[0]);
    expect(sent).not.toMatch(/Summary Person|9333300001|ORD-S/);
    expect(writer.calls[0]?.results[0]).toMatchObject({
      flag: "HIGH",
      words: "much higher than usual",
    });
  });

  it("reuses the stored summary instead of asking again", async () => {
    const writer = goodWriter();
    await summaryForReport(await report("ORD-S-LDL1"), "en", { writer });
    expect(writer.calls).toHaveLength(0);
  });

  it("refuses an AI summary that diagnoses, and falls back to the rule lines", async () => {
    const writer = new FakeWriter(
      () => "Your LDL cholesterol is much higher than usual, which means heart disease.",
    );
    const r = await report("ORD-S-LDL2");
    const out = await summaryForReport(r, "en", { writer });
    expect(out.ai).toBeNull();
    expect(out.summary.kind === "RESULTS" && out.summary.intro).toMatch(/much higher than usual/);
    const stored = await db.aiSummary.findFirstOrThrow({ where: { reportId: r.id } });
    expect(stored.status).toBe("REJECTED");
    expect(stored.checkerNotes).toMatch(/disease/);
  });

  it("falls back to the rule lines when the AI fails, and records the failure", async () => {
    const writer = new FakeWriter(() => {
      throw new Error("timed out");
    });
    const r = await report("ORD-S-LDL3");
    await db.aiSummary.deleteMany({ where: { reportId: r.id } });
    const out = await summaryForReport(r, "en", { writer });
    expect(out.ai).toBeNull();
    const stored = await db.aiSummary.findFirstOrThrow({ where: { reportId: r.id } });
    expect(stored).toMatchObject({ status: "FAILED", checkerNotes: "timed out" });
  });
});
