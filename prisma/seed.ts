import "dotenv/config";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db/client";
import { hashPhone, normalisePhone } from "@/lib/domain/phone";
import { hashSecret } from "@/lib/domain/tokens";
import { env } from "@/lib/env";
import { importLisCsv } from "@/lib/import/service";
import { MockSmsProvider } from "@/lib/sms/provider";
import { upsertDefaultTemplates } from "@/lib/summary/seed-templates";
import { upsertCatalog } from "./catalog";

/**
 * Demo data. All of it is synthetic: the brief's three sample orders plus
 * invented family members, with fake numbers (+91 90000 0000x).
 *
 * The data goes in through the real import pipeline, so the demo shows exactly
 * what an LIS export produces: flags by rule, links on sign-off, critical calls.
 */

const at = (iso: string) => () => new Date(iso);

async function main() {
  const keys = env();
  const sms = new MockSmsProvider();
  await upsertCatalog(db);
  await upsertDefaultTemplates(db);

  // Older exports first, imported "as of" their own dates, so their links have expired.
  const exports = [
    { file: "samples/lis-export-2026-08-12.csv", now: at("2026-08-12T10:15:00+05:30") },
    { file: "samples/lis-export-2026-10-28.csv", now: at("2026-10-28T11:25:00+05:30") },
    { file: "samples/lis-export-2026-11-04.csv", now: () => new Date() },
  ];
  for (const { file, now } of exports) {
    const result = await importLisCsv(
      { fileName: file.split("/").pop()!, content: readFileSync(file, "utf8"), source: "FOLDER" },
      { sms, now },
    );
    if (!result.ok) throw new Error(`${file}: ${result.fileError}`);
    console.info(`Imported ${file}: ${result.totalRows} rows, ${result.linksSent} links`);
  }

  // The older pages were read when they arrived, so they show as filed away, not new.
  for (const orderId of ["ORD-68811", "ORD-71150"]) {
    const report = await db.report.findFirst({
      where: { orderId },
      include: { patient: true, links: true },
    });
    if (!report?.signedAt) continue;
    const opened = await db.accessLog.findFirst({
      where: { reportId: report.id, action: "REPORT_OPENED" },
    });
    if (opened) continue;
    const at = new Date(report.signedAt.getTime() + 2 * 60 * 60_000);
    await db.accessLog.create({
      data: {
        at,
        actorType: "PATIENT",
        action: "REPORT_OPENED",
        householdId: report.patient.householdId,
        patientId: report.patientId,
        reportId: report.id,
        detail: { via: "link", seeded: true },
      },
    });
    for (const link of report.links) {
      await db.reportLink.update({
        where: { id: link.id },
        data: { firstOpenedAt: at, lastOpenedAt: at, openCount: 1 },
      });
    }
  }

  // Staff. The demo password comes from the environment, never from the code.
  const password = process.env.DEMO_STAFF_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("Set DEMO_STAFF_PASSWORD (12 characters or more) before seeding.");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  for (const staff of [
    { email: "frontdesk@demo.lab", name: "Padma (front desk)", role: "FRONT_DESK" as const },
    { email: "labadmin@demo.lab", name: "Dr. Rao (lab admin)", role: "LAB_ADMIN" as const },
  ]) {
    await db.staffUser.upsert({
      where: { email: staff.email },
      create: { ...staff, passwordHash },
      update: { passwordHash, role: staff.role, active: true, failedLogins: 0, lockedUntil: null },
    });
  }

  // A number already paused after five wrong codes, to show and test the lockout.
  const lockedPhone = hashPhone(normalisePhone("+91 90000 00004")!, keys.PHONE_HASH_KEY);
  const locked = await db.otpChallenge.findFirst({ where: { phoneHash: lockedPhone } });
  if (!locked) {
    const now = Date.now();
    await db.otpChallenge.create({
      data: {
        phoneHash: lockedPhone,
        codeHash: hashSecret("000000", keys.TOKEN_HASH_KEY),
        attempts: 5,
        expiresAt: new Date(now + 10 * 60_000),
        lockedUntil: new Date(now + 15 * 60_000),
      },
    });
  }

  console.info("Seed complete. Demo patient numbers: +91 90000 00001, 00002, 00003.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
