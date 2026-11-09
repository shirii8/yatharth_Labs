import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeskShell } from "@/components/staff/DeskShell";
import styles from "@/components/staff/insight.module.css";
import { ipHash } from "@/lib/auth/cookies";
import { requireStaff } from "@/lib/auth/staff-guard";
import { db } from "@/lib/db/client";
import { doctorReport, stateOf } from "@/lib/doctor/reports";
import { dateTime, formatUnit } from "@/lib/patient-format";
import desk from "../../desk.module.css";

export const metadata: Metadata = { title: "Report" };

/**
 * One report for the referring doctor: every value with its range and flag,
 * the signed PDF, and, for a critical value, whether the lab has reached the
 * patient yet, so the doctor does not call blind.
 */
export default async function DoctorReportPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { staff } = await requireStaff("doctorReports");
  const { reportId } = await params;
  const report = await doctorReport(staff, reportId, { ipHash: await ipHash() });
  // Not theirs, too old or not signed: the same "not found", so nothing leaks.
  if (!report || report.status !== "SIGNED") notFound();

  const state = stateOf(report);
  const task = report.hasCritical
    ? await db.callbackTask.findFirst({
        where: { reportId: report.id, type: "CRITICAL" },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return (
    <DeskShell staff={staff} current="/desk/doctor">
      <Link href="/desk/doctor" className={styles.open} prefetch={false}>
        ← All your patients&apos; reports
      </Link>
      <div className={styles.head} style={{ marginTop: 16 }}>
        <div>
          <h1 className={desk.title} style={{ marginBottom: 8 }}>
            {report.patient.name}
          </h1>
          <p className={styles.lede} style={{ margin: 0 }}>
            {report.patient.age} · {report.patient.sex.toLowerCase()} · {report.test.name} · order{" "}
            {report.orderId} · signed {report.signedAt ? dateTime(report.signedAt) : ""}
          </p>
        </div>
        <span className={styles.pill} data-tone={state.tone}>
          {state.word}
        </span>
      </div>

      {task ? (
        <div className={desk.card} data-tone="critical" style={{ marginBottom: 24 }}>
          <span className={desk.kicker} data-tone="critical">
            Critical value · the lab&apos;s call to the patient
          </span>
          <span>
            {task.status === "DONE" && task.doneAt
              ? `Done at ${dateTime(task.doneAt)}.${task.note ? ` Note: "${task.note}"` : ""}`
              : `Not reached yet. Due by ${dateTime(task.dueAt)}. The patient saw no number, only "Please call us".`}
          </span>
        </div>
      ) : null}

      <table className={desk.table}>
        <thead>
          <tr>
            <th scope="col">Parameter</th>
            <th scope="col">Result</th>
            <th scope="col">Reference range</th>
            <th scope="col">Flag</th>
          </tr>
        </thead>
        <tbody>
          {report.results.map((r) => (
            <tr key={r.id} className={r.isCritical ? styles.rowCritical : undefined}>
              <td>{r.analyte.name}</td>
              <td className={r.flag !== "USUAL" ? styles.hi : undefined}>
                {r.valueText} {formatUnit(r.analyte.unit)}
              </td>
              <td>{r.refText}</td>
              <td>
                {r.isCritical
                  ? "Critical"
                  : r.flag === "LOW"
                    ? "Low"
                    : r.flag === "HIGH"
                      ? "High"
                      : "Usual"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={desk.actions} style={{ marginTop: 24 }}>
        <a href={`/desk/doctor/${report.id}/pdf`} className={desk.btnPrimary}>
          Download the signed PDF
        </a>
        <span className={desk.muted}>
          Flags come from the lab&apos;s rules against the printed range.
        </span>
      </div>
    </DeskShell>
  );
}
