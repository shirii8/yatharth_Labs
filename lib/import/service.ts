import { createHash } from "node:crypto";
import { db as defaultDb } from "@/lib/db/client";
import { reportHasCritical, isCritical } from "@/lib/domain/critical";
import { flagForValue, type Flag } from "@/lib/domain/flags";
import { encryptPhone, hashPhone, maskPhone } from "@/lib/domain/phone";
import { generateToken, hashSecret, linkExpiresAt } from "@/lib/domain/tokens";
import { env } from "@/lib/env";
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import { smsProvider, type SmsProvider } from "@/lib/sms/provider";
import { parseCsv } from "./csv";
import { linkMessage } from "./message";
import {
  missingColumns,
  validateRows,
  type ReportStatus,
  type RowError,
  type TestCatalog,
  type ValidRow,
} from "./validate";

/**
 * Imports one LIS export. Each report is saved in its own transaction together
 * with everything that must happen with it: the rule flags, the report link
 * when it becomes signed, the access-log line, and the critical callback task.
 * SMS goes out only after that transaction commits, so a message is never sent
 * for a report that failed to save.
 */

type RowStatus = "IMPORTED" | "UPDATED" | "UNCHANGED" | "ERROR";

export type ImportResult =
  | { ok: false; fileError: string }
  | {
      ok: true;
      batchId: string;
      totalRows: number;
      importedRows: number;
      updatedRows: number;
      unchangedRows: number;
      errorRows: number;
      linksSent: number;
      criticalTasks: number;
      errors: RowError[];
    };

export interface ImportInput {
  fileName: string;
  content: string;
  source?: "UPLOAD" | "FOLDER";
  uploadedById?: string;
}

export interface ImportDeps {
  db?: PrismaClient;
  sms?: SmsProvider;
  now?: () => Date;
}

/** A link waiting to be sent once its transaction has committed. */
interface PendingSms {
  linkId: string;
  phone: string;
  body: string;
}

interface ReportOutcome {
  rowStatus: RowStatus;
  error?: string;
  sms?: PendingSms;
  criticalTask: boolean;
}

const STATUS_RANK: Record<ReportStatus, number> = { SAMPLE_GIVEN: 0, TESTED: 1, SIGNED: 2 };
const CRITICAL_CALL_WITHIN_MINUTES = 30;

type CatalogTest = Prisma.TestDefinitionGetPayload<{ include: { analytes: true } }>;

export async function importLisCsv(
  input: ImportInput,
  deps: ImportDeps = {},
): Promise<ImportResult> {
  const db = deps.db ?? defaultDb;
  const sms = deps.sms ?? smsProvider();
  const now = deps.now ?? (() => new Date());
  const keys = env();

  const { header, records } = parseCsv(input.content);
  if (header.length === 0) return { ok: false, fileError: "The file is empty." };
  const missing = missingColumns(header);
  if (missing.length > 0) {
    return {
      ok: false,
      fileError: `The file is missing these columns: ${missing.join(", ")}. The first row must name the columns.`,
    };
  }

  const tests = await db.testDefinition.findMany({ include: { analytes: true } });
  const testsByCode = new Map(tests.map((t) => [t.code, t]));
  const catalog: TestCatalog = Object.fromEntries(
    tests.map((t) => [t.code, { analytes: t.analytes }]),
  );
  const { valid, errors } = validateRows(records, catalog);

  const batch = await db.importBatch.create({
    data: {
      fileName: input.fileName,
      fileHash: createHash("sha256").update(input.content).digest("hex"),
      source: input.source ?? "UPLOAD",
      uploadedById: input.uploadedById,
      totalRows: records.length,
      importedRows: 0,
      errorRows: errors.length,
    },
  });

  // Rows of one order and test form one report.
  const groups = new Map<string, ValidRow[]>();
  for (const row of valid) {
    const key = `${row.orderId}|${row.testCode}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const rowStatus = new Map<number, { status: RowStatus; error?: string }>();
  const pending: PendingSms[] = [];
  let criticalTasks = 0;

  for (const rows of groups.values()) {
    let outcome: ReportOutcome;
    try {
      outcome = await db.$transaction((tx) =>
        saveReport(tx, rows, testsByCode, keys, now(), input.uploadedById),
      );
    } catch {
      outcome = {
        rowStatus: "ERROR",
        error: "This order could not be saved. Please upload the file again.",
        criticalTask: false,
      };
    }
    for (const row of rows)
      rowStatus.set(row.rowNumber, { status: outcome.rowStatus, error: outcome.error });
    if (outcome.sms) pending.push(outcome.sms);
    if (outcome.criticalTask) criticalTasks += 1;
  }

  const outcomeRows = [
    ...valid.map((row) => ({
      rowNumber: row.rowNumber,
      orderId: row.orderId,
      status: rowStatus.get(row.rowNumber)?.status ?? "ERROR",
      error: rowStatus.get(row.rowNumber)?.error ?? null,
      raw: records[row.rowNumber - 2] ?? {},
    })),
    ...errors.map((e) => ({
      rowNumber: e.rowNumber,
      orderId: e.orderId,
      status: "ERROR" as const,
      error: e.messages.join(" "),
      raw: e.raw,
    })),
  ].sort((a, b) => a.rowNumber - b.rowNumber);

  const count = (s: RowStatus) => outcomeRows.filter((r) => r.status === s).length;
  const imported = count("IMPORTED");
  const updated = count("UPDATED");
  const failed = count("ERROR");

  await db.importRow.createMany({
    data: outcomeRows.map((r) => ({ ...r, batchId: batch.id })),
  });
  await db.importBatch.update({
    where: { id: batch.id },
    data: { importedRows: imported + updated, errorRows: failed },
  });
  await db.accessLog.create({
    data: {
      actorType: input.uploadedById ? "STAFF" : "SYSTEM",
      actorId: input.uploadedById,
      action: "IMPORT_RUN",
      detail: { batchId: batch.id, fileName: input.fileName, rows: records.length, errors: failed },
    },
  });

  await sendPending(db, sms, pending, now);

  return {
    ok: true,
    batchId: batch.id,
    totalRows: records.length,
    importedRows: imported,
    updatedRows: updated,
    unchangedRows: count("UNCHANGED"),
    errorRows: failed,
    linksSent: pending.length,
    criticalTasks,
    errors,
  };
}

async function saveReport(
  tx: Prisma.TransactionClient,
  rows: ValidRow[],
  testsByCode: Map<string, CatalogTest>,
  keys: ReturnType<typeof env>,
  now: Date,
  staffId: string | undefined,
): Promise<ReportOutcome> {
  const first = rows[0]!;
  const test = testsByCode.get(first.testCode)!;

  const phoneHash = hashPhone(first.phone, keys.PHONE_HASH_KEY);
  const household = await tx.household.upsert({
    where: { phoneHash },
    create: {
      phoneHash,
      phoneCipher: encryptPhone(first.phone, keys.PHONE_ENC_KEY),
      phoneMasked: maskPhone(first.phone),
    },
    update: {},
  });
  const patient = await tx.patient.upsert({
    where: { householdId_name: { householdId: household.id, name: first.patientName } },
    create: {
      householdId: household.id,
      name: first.patientName,
      age: first.age,
      sex: first.sex,
      relation: first.relation,
    },
    update: { age: first.age, sex: first.sex },
  });
  const doctor = first.referringDoctor
    ? await tx.referringDoctor.upsert({
        where: { name: first.referringDoctor },
        create: { name: first.referringDoctor },
        update: {},
      })
    : null;

  const existing = await tx.report.findUnique({
    where: { orderId_testId: { orderId: first.orderId, testId: test.id } },
    include: { results: true },
  });

  if (existing && existing.patientId !== patient.id) {
    return {
      rowStatus: "ERROR",
      error: `Order ${first.orderId} (${first.testCode}) already belongs to another patient. Check the name and phone.`,
      criticalTask: false,
    };
  }
  // A signed report is final. A later export that says otherwise is ignored.
  if (existing?.status === "SIGNED" && first.status !== "SIGNED") {
    return { rowStatus: "UNCHANGED", criticalTask: false };
  }

  const status: ReportStatus =
    existing && STATUS_RANK[existing.status] > STATUS_RANK[first.status]
      ? existing.status
      : first.status;

  // Flags and critical checks: rules only, against the range printed on this report.
  const computed = rows
    .filter((r): r is ValidRow & { value: number } => r.value !== null)
    .map((r) => {
      const analyte = test.analytes.find((a) => a.code === r.analyteCode)!;
      const flag: Flag = r.range ? flagForValue(r.value, r.range) : "USUAL";
      return { row: r, analyte, flag, critical: isCritical(r.value, analyte) };
    });
  const hasCritical = reportHasCritical(
    computed.map((c) => c.critical),
    rows.some((r) => r.lisCritical),
  );

  const reportData = {
    status,
    signedAt: status === "SIGNED" ? (existing?.signedAt ?? first.signedAt ?? now) : null,
    hasCritical,
    referringDoctorId: doctor?.id ?? null,
  };
  const report = existing
    ? await tx.report.update({ where: { id: existing.id }, data: reportData })
    : await tx.report.create({
        data: { ...reportData, orderId: first.orderId, patientId: patient.id, testId: test.id },
      });

  let resultsChanged = false;
  for (const c of computed) {
    const data = {
      value: c.row.value,
      valueText: c.row.valueText,
      refLow: c.row.range?.low ?? null,
      refHigh: c.row.range?.high ?? null,
      refText: c.row.refText,
      flag: c.flag,
      isCritical: c.critical,
    };
    const before = existing?.results.find((r) => r.analyteId === c.analyte.id);
    if (!before) {
      await tx.result.create({ data: { ...data, reportId: report.id, analyteId: c.analyte.id } });
      resultsChanged = true;
    } else if (before.valueText !== data.valueText || before.refText !== data.refText) {
      await tx.result.update({ where: { id: before.id }, data });
      resultsChanged = true;
    }
  }

  const statusChanged = existing
    ? existing.status !== status || existing.hasCritical !== hasCritical
    : true;
  const rowStatus: RowStatus = !existing
    ? "IMPORTED"
    : resultsChanged || statusChanged
      ? "UPDATED"
      : "UNCHANGED";

  let criticalTask = false;
  if (status === "SIGNED" && hasCritical) {
    const open = await tx.callbackTask.findFirst({
      where: { reportId: report.id, type: "CRITICAL", status: "OPEN" },
    });
    if (!open) {
      await tx.callbackTask.create({
        data: {
          type: "CRITICAL",
          householdId: household.id,
          patientId: patient.id,
          reportId: report.id,
          reason: "A result on this signed report crossed a critical limit.",
          dueAt: new Date(now.getTime() + CRITICAL_CALL_WITHIN_MINUTES * 60_000),
        },
      });
      criticalTask = true;
    }
  }

  let sms: PendingSms | undefined;
  // Withdrawn consent means no links and no SMS. A critical call above still happens.
  const mayMessage = household.consentWithdrawnAt === null;
  if (status === "SIGNED" && existing?.status !== "SIGNED" && mayMessage) {
    const token = generateToken();
    const link = await tx.reportLink.create({
      data: {
        reportId: report.id,
        tokenHash: hashSecret(token, keys.TOKEN_HASH_KEY),
        expiresAt: linkExpiresAt(now),
        createdById: staffId,
        createdAt: now,
      },
    });
    await tx.accessLog.create({
      data: {
        actorType: "SYSTEM",
        action: "LINK_SENT",
        householdId: household.id,
        patientId: patient.id,
        reportId: report.id,
        detail: { linkId: link.id, reason: "signed" },
      },
    });
    sms = {
      linkId: link.id,
      phone: first.phone,
      body: linkMessage({
        patientName: patient.name,
        testName: test.name,
        url: `${keys.APP_BASE_URL}/r/${token}`,
      }),
    };
  }

  return { rowStatus, sms, criticalTask };
}

/** Sends each queued link and records what the provider said. A failure shows on the desk. */
async function sendPending(
  db: PrismaClient,
  sms: SmsProvider,
  pending: PendingSms[],
  now: () => Date,
): Promise<void> {
  for (const message of pending) {
    let status: "SENT" | "DELIVERED" | "FAILED" = "FAILED";
    let messageId: string | null = null;
    try {
      const result = await sms.send(message.phone, message.body);
      status = result.status;
      messageId = result.messageId;
    } catch {
      status = "FAILED";
    }
    const at = now();
    await db.reportLink.update({
      where: { id: message.linkId },
      data: {
        deliveryStatus: status,
        providerMessageId: messageId,
        sentAt: status === "FAILED" ? null : at,
        deliveredAt: status === "DELIVERED" ? at : null,
      },
    });
  }
}
