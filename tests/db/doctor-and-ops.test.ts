import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { doctorReport, doctorReports } from "@/lib/doctor/reports";
import { importLisCsv } from "@/lib/import/service";
import { MockSmsProvider } from "@/lib/sms/provider";
import { opsReport } from "@/lib/staff/ops-report";
import { upsertCatalog } from "@/prisma/catalog";

const HEADER =
  "Order ID,Patient,Phone,Age,Sex,Relation,Test Code,Parameter,Result,Reference Range,Status,Referring Doctor,Signed At";
// A window far from every other test file, so counts here are only this file's data.
const NOW = new Date("2031-03-20T10:00:00Z");
const DOC_A = "Dr. Test Alpha";
const DOC_B = "Dr. Test Beta";

let doctorA: { id: string; role: "DOCTOR"; doctorId: string | null };
let doctorB: { id: string; role: "DOCTOR"; doctorId: string | null };

beforeAll(async () => {
  await upsertCatalog(db);
  await importLisCsv(
    {
      fileName: "doctor-ops.csv",
      content: [
        HEADER,
        // Doctor A: two signed this month, one still processing, one signed 4 months ago.
        `ORD-DOC-1,Alpha One,+919555700001,40,F,Self,CBC,Haemoglobin,10.2,12.0-15.5,Ready,${DOC_A},2031-03-18T09:00:00Z`,
        `ORD-DOC-2,Alpha Two,+919555700002,55,M,Self,ELEC,Potassium,6.8,3.5-5.1,Ready (critical),${DOC_A},2031-03-19T09:00:00Z`,
        `ORD-DOC-3,Alpha Three,+919555700003,62,M,Self,LIPID,LDL cholesterol,142,0-100,Processing,${DOC_A},`,
        `ORD-DOC-4,Alpha Four,+919555700004,30,F,Self,CBC,Haemoglobin,13,12.0-15.5,Ready,${DOC_A},2030-11-01T09:00:00Z`,
        // Doctor B: one signed this month.
        `ORD-DOC-5,Beta One,+919555700005,35,F,Self,CBC,Haemoglobin,13,12.0-15.5,Ready,${DOC_B},2031-03-17T09:00:00Z`,
      ].join("\n"),
    },
    { sms: new MockSmsProvider(), now: () => NOW },
  );
  const doctors = await db.referringDoctor.findMany({ where: { name: { in: [DOC_A, DOC_B] } } });
  const make = async (name: string, email: string) => {
    const d = doctors.find((x) => x.name === name)!;
    return db.staffUser.create({
      data: { email, name, passwordHash: "x", role: "DOCTOR", doctorId: d.id },
    });
  };
  doctorA = (await make(DOC_A, "alpha@test.clinic")) as typeof doctorA;
  doctorB = (await make(DOC_B, "beta@test.clinic")) as typeof doctorB;

  // The processing order came in yesterday (in test time).
  await db.report.updateMany({
    where: { orderId: "ORD-DOC-3" },
    data: { createdAt: new Date("2031-03-19T08:00:00Z") },
  });

  // A patient opens ORD-DOC-1 ten hours after signing.
  const one = await db.report.findFirstOrThrow({ where: { orderId: "ORD-DOC-1" } });
  await db.accessLog.create({
    data: {
      actorType: "PATIENT",
      action: "REPORT_OPENED",
      reportId: one.id,
      at: new Date("2031-03-18T19:00:00Z"),
    },
  });
});
afterAll(() => db.$disconnect());

describe("Referring doctor view", () => {
  it("lists only this doctor's patients from the last 90 days, processing ones included", async () => {
    const rows = await doctorReports(doctorA, { now: NOW });
    expect(rows.map((r) => r.orderId).sort()).toEqual(["ORD-DOC-1", "ORD-DOC-2", "ORD-DOC-3"]);
  });

  it("never shows another doctor's patients", async () => {
    const rows = await doctorReports(doctorB, { now: NOW });
    expect(rows.map((r) => r.orderId)).toEqual(["ORD-DOC-5"]);
  });

  it("shows a doctor the critical values, which patients never see as numbers", async () => {
    const rows = await doctorReports(doctorA, { now: NOW });
    const critical = rows.find((r) => r.orderId === "ORD-DOC-2")!;
    expect(critical.hasCritical).toBe(true);
    expect(critical.results[0]?.valueText).toBe("6.8");
  });

  it("opens one report for its own doctor and writes it to the access log", async () => {
    const report = await db.report.findFirstOrThrow({ where: { orderId: "ORD-DOC-1" } });
    const found = await doctorReport(doctorA, report.id, { now: NOW });
    expect(found?.orderId).toBe("ORD-DOC-1");
    expect(
      await db.accessLog.count({
        where: { action: "DOCTOR_VIEWED_REPORT", reportId: report.id, actorId: doctorA.id },
      }),
    ).toBe(1);
  });

  it("refuses another doctor's report, an old one, and anyone who is not a doctor", async () => {
    const theirs = await db.report.findFirstOrThrow({ where: { orderId: "ORD-DOC-5" } });
    const old = await db.report.findFirstOrThrow({ where: { orderId: "ORD-DOC-4" } });
    expect(await doctorReport(doctorA, theirs.id, { now: NOW })).toBeNull();
    expect(await doctorReport(doctorA, old.id, { now: NOW })).toBeNull();
    const desk = { id: "desk", role: "FRONT_DESK" as const, doctorId: null };
    expect(await doctorReports(desk, { now: NOW })).toEqual([]);
    expect(await doctorReport(desk, theirs.id, { now: NOW })).toBeNull();
    expect(
      await db.accessLog.count({
        where: { action: "DOCTOR_VIEWED_REPORT", reportId: { in: [theirs.id, old.id] } },
      }),
    ).toBe(0);
  });
});

describe("Delivery and access report", () => {
  it("counts signed, sent, delivered and opened reports against the brief's targets", async () => {
    const r = await opsReport({ days: 7, now: NOW });
    // Signed in the week: ORD-DOC-1, 2 and 5 (4 is older, 3 is still processing).
    expect(r.signed).toBe(3);
    expect(r.linkSent).toBe(3);
    expect(r.delivered).toBe(3);
    expect(r.opened).toBe(1);
    expect(r.openedIn72h).toBe(1);
    expect(r.digitalRate).toBeCloseTo(1 / 3);
    expect(r.medianHoursToOpen).toBe(10);
  });

  it("follows each critical value to its call", async () => {
    const r = await opsReport({ days: 7, now: NOW });
    expect(r.critical.total).toBe(1);
    expect(r.critical.open).toBe(1);
    expect(r.critical.called).toBe(0);
  });

  it("gives one row per day for the trend", async () => {
    const r = await opsReport({ days: 7, now: NOW });
    expect(r.days).toHaveLength(7);
    expect(r.days.reduce((n, d) => n + d.signed, 0)).toBe(3);
    expect(r.days.find((d) => d.day === "2031-03-18")).toMatchObject({ signed: 1, opened: 1 });
  });
});
