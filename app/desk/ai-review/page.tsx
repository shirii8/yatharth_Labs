import type { Metadata } from "next";
import { DeskShell } from "@/components/staff/DeskShell";
import { requireStaff } from "@/lib/auth/staff-guard";
import { db } from "@/lib/db/client";
import { dateTime } from "@/lib/patient-format";
import { reviewAiAction } from "../actions";
import styles from "../desk.module.css";

export const metadata: Metadata = { title: "AI summary review" };

/** The brief's weekly review: a pathologist reads 50 AI summaries a week. */
const WEEKLY_TARGET = 50;

/**
 * Lab admin only. Every AI attempt, newest first: shown ones to check, and
 * refused or failed ones with the checker's reason. Marking a shown summary
 * "wrong" stops it showing at once.
 */
export default async function AiReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const { staff } = await requireStaff("reviewAi");
  const { msg } = await searchParams;
  const weekAgo = new Date(new Date().getTime() - 7 * 24 * 60 * 60_000);
  const [toReview, reviewedThisWeek, refused] = await Promise.all([
    db.aiSummary.findMany({
      where: { reviewedAt: null, status: "SHOWN" },
      orderBy: { createdAt: "desc" },
      take: WEEKLY_TARGET,
      include: { report: { include: { test: true, results: { include: { analyte: true } } } } },
    }),
    db.aiSummary.count({ where: { reviewedAt: { gte: weekAgo } } }),
    db.aiSummary.findMany({
      where: { status: { in: ["REJECTED", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { report: { include: { test: true } } },
    }),
  ]);

  return (
    <DeskShell staff={staff} current="/desk/ai-review">
      <h1 className={styles.title}>AI summary review</h1>
      <p className={styles.muted} style={{ marginTop: 0 }}>
        Reviewed this week: {reviewedThisWeek} of {WEEKLY_TARGET}. Flags always come from the
        lab&apos;s rules; here you check the AI&apos;s wording around them.
      </p>
      {msg === "saved" ? (
        <p className={styles.notice} role="status">
          Saved. A summary marked wrong no longer shows to the patient.
        </p>
      ) : null}

      <h2 className={styles.h2}>Shown to patients, not yet reviewed ({toReview.length})</h2>
      {toReview.length === 0 ? <p className={styles.muted}>Nothing waiting for review.</p> : null}
      {toReview.map((s) => (
        <div key={s.id} className={styles.card}>
          <span className={styles.kicker}>
            {s.report.test.name} · {dateTime(s.createdAt)} · {s.model} · {s.promptVersion}
          </span>
          <span style={{ fontSize: 19 }}>{s.body}</span>
          <span className={styles.muted} style={{ fontSize: 15 }}>
            Rule findings:{" "}
            {s.report.results
              .map((r) => `${r.analyte.name} ${r.valueText} (${r.refText}) ${r.flag.toLowerCase()}`)
              .join("; ")}
          </span>
          <form action={reviewAiAction} className={styles.actions}>
            <input type="hidden" name="id" value={s.id} />
            <label htmlFor={`v-${s.id}`} className="visually-hidden">
              Verdict
            </label>
            <select id={`v-${s.id}`} name="verdict" className={styles.input} defaultValue="GOOD">
              <option value="GOOD">Good</option>
              <option value="NEEDS_CHANGE">Needs a change</option>
              <option value="WRONG">Wrong: stop showing it</option>
            </select>
            <label htmlFor={`n-${s.id}`} className="visually-hidden">
              Note
            </label>
            <input
              id={`n-${s.id}`}
              name="note"
              className={styles.input}
              placeholder="Note (optional)"
            />
            <button type="submit" className={styles.btnPrimary}>
              Save review
            </button>
          </form>
        </div>
      ))}

      <h2 className={styles.h2}>Refused by the checker or failed ({refused.length})</h2>
      <p className={styles.muted} style={{ marginTop: -8 }}>
        Patients saw the rule wording instead of these.
      </p>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Test</th>
            <th scope="col">Outcome</th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          {refused.map((s) => (
            <tr key={s.id}>
              <td>{dateTime(s.createdAt)}</td>
              <td>{s.report.test.name}</td>
              <td>{s.status === "REJECTED" ? "Refused" : "Failed"}</td>
              <td>{s.checkerNotes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DeskShell>
  );
}
