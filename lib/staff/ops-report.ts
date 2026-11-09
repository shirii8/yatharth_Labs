import { db } from "@/lib/db/client";

/**
 * The delivery and access report for the operations head. It answers the
 * brief's success measures from data the app already keeps: how many signed
 * reports went out and were opened online (target: 80% delivered digitally),
 * how fast critical values were called, and every sign of a report reaching
 * the wrong person (target: none).
 *
 * At demo scale this reads rows directly. At 2,000 reports a day it would read
 * a nightly roll-up table instead (TDD, next steps).
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type OpsReport = Awaited<ReturnType<typeof opsReport>>;

export async function opsReport(opts: { days: number; now?: Date }) {
  const now = opts.now ?? new Date();
  const from = new Date(now.getTime() - opts.days * DAY);
  const inWindow = { gte: from, lte: now };

  const reports = await db.report.findMany({
    where: { status: "SIGNED", signedAt: inWindow },
    select: { id: true, signedAt: true, links: { select: { deliveryStatus: true } } },
  });
  const ids = reports.map((r) => r.id);

  const [firstOpens, resends, pdfs, tasks, flags, logs, callMeBack] = await Promise.all([
    db.accessLog.groupBy({
      by: ["reportId"],
      where: {
        reportId: { in: ids },
        actorType: "PATIENT",
        action: { in: ["REPORT_OPENED", "LINK_OPENED"] },
      },
      _min: { at: true },
    }),
    db.accessLog.count({ where: { reportId: { in: ids }, action: "LINK_RESENT" } }),
    db.accessLog.count({ where: { reportId: { in: ids }, action: "REPORT_PDF_DOWNLOADED" } }),
    db.callbackTask.findMany({
      where: { reportId: { in: ids }, type: "CRITICAL" },
      select: { status: true, createdAt: true, doneAt: true, dueAt: true },
    }),
    db.patientFlag.findMany({ where: { reportId: { in: ids } }, select: { kind: true } }),
    db.accessLog.groupBy({ by: ["action"], where: { at: inWindow }, _count: { _all: true } }),
    db.callbackTask.count({ where: { type: "CALL_ME_BACK", createdAt: inWindow } }),
  ]);

  const opened = new Map(firstOpens.map((o) => [o.reportId!, o._min.at!]));
  const hoursToOpen = reports
    .filter((r) => opened.has(r.id) && r.signedAt)
    .map((r) => (opened.get(r.id)!.getTime() - r.signedAt!.getTime()) / HOUR);
  const logCount = (action: string) => logs.find((l) => l.action === action)?._count._all ?? 0;
  const called = tasks.filter((t) => t.status === "DONE" && t.doneAt);

  // One row per calendar day (UTC), oldest first, for the trend bars.
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const days = Array.from({ length: opts.days }, (_, i) => {
    const start = today - (opts.days - 1 - i) * DAY;
    const inDay = (d: Date | null) => !!d && d.getTime() >= start && d.getTime() < start + DAY;
    return {
      day: new Date(start).toISOString().slice(0, 10),
      signed: reports.filter((r) => inDay(r.signedAt)).length,
      opened: reports.filter((r) => inDay(r.signedAt) && opened.has(r.id)).length,
    };
  });

  return {
    from,
    to: now,
    signed: reports.length,
    linkSent: reports.filter((r) => r.links.length > 0).length,
    delivered: reports.filter((r) => r.links.some((l) => l.deliveryStatus === "DELIVERED")).length,
    failed: reports.filter(
      (r) => r.links.length > 0 && r.links.every((l) => l.deliveryStatus === "FAILED"),
    ).length,
    opened: opened.size,
    openedIn72h: hoursToOpen.filter((h) => h <= 72).length,
    digitalRate: reports.length ? opened.size / reports.length : null,
    medianHoursToOpen: median(hoursToOpen),
    resends,
    pdfDownloads: pdfs,
    critical: {
      total: tasks.length,
      called: called.length,
      open: tasks.filter((t) => t.status === "OPEN").length,
      overdue: tasks.filter((t) => t.status === "OPEN" && t.dueAt < now).length,
      medianMinutesToCall: median(
        called.map((t) => (t.doneAt!.getTime() - t.createdAt.getTime()) / 60000),
      ),
    },
    callMeBack,
    flags: { total: flags.length, wrongPerson: flags.filter((f) => f.kind === "NAME").length },
    otp: {
      sent: logCount("OTP_SENT"),
      verified: logCount("OTP_VERIFIED"),
      failed: logCount("OTP_FAILED"),
      locked: logCount("OTP_LOCKED"),
    },
    views: {
      staff: logCount("STAFF_VIEWED_PATIENT"),
      phone: logCount("STAFF_VIEWED_PHONE"),
      doctor: logCount("DOCTOR_VIEWED_REPORT"),
    },
    days,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const m = sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Math.round(m * 10) / 10;
}
