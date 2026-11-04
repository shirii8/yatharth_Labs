import type { Metadata } from "next";
import Link from "next/link";
import { DeskShell } from "@/components/staff/DeskShell";
import { requireStaff } from "@/lib/auth/staff-guard";
import { db } from "@/lib/db/client";
import { dateTime } from "@/lib/patient-format";
import { doneTaskAction, resolveFlagAction } from "../actions";
import styles from "../desk.module.css";

export const metadata: Metadata = { title: "Callbacks and flags" };

/** Today's calls: critical values first, then call-me-back requests, then patient flags. */
export default async function CallsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const { staff } = await requireStaff("callbacks");
  const { msg } = await searchParams;
  const tasks = await db.callbackTask.findMany({
    where: { status: "OPEN" },
    orderBy: [{ type: "asc" }, { dueAt: "asc" }],
    include: {
      household: true,
      patient: true,
      report: { include: { test: true, results: { include: { analyte: true } } } },
    },
  });
  const flags = await db.patientFlag.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    include: { patient: { include: { household: true } }, report: { include: { test: true } } },
  });
  const now = new Date().getTime();

  return (
    <DeskShell staff={staff} current="/desk/calls">
      <h1 className={styles.title}>Callbacks and flags</h1>
      {msg === "note-needed" ? (
        <p className={`${styles.notice} ${styles.error}`} role="alert">
          Please write a short note before marking it done.
        </p>
      ) : null}
      {tasks.length === 0 && flags.length === 0 ? (
        <p className={styles.muted}>Nothing waiting. New critical values appear here at once.</p>
      ) : null}

      <div className={styles.columns}>
        <section aria-labelledby="calls">
          <h2 id="calls" className={styles.h2}>
            Calls to make ({tasks.length})
          </h2>
          {tasks.map((task) => {
            const critical = task.type === "CRITICAL";
            const late = task.dueAt.getTime() < now;
            const values = critical
              ? (task.report?.results.filter((r) => r.isCritical || r.flag !== "USUAL") ?? [])
              : [];
            return (
              <div
                key={task.id}
                className={styles.card}
                data-tone={critical ? "critical" : undefined}
              >
                <span className={styles.kicker} data-tone={critical ? "critical" : undefined}>
                  {critical ? "Critical value" : "Call me back"}
                  {late ? " · overdue" : ""}
                </span>
                <strong style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 500 }}>
                  {task.patient
                    ? `${task.patient.name}, ${task.patient.age}`
                    : "Family on this number"}
                  {task.report ? ` · ${task.report.test.name}` : ""}
                </strong>
                {values.map((r) => (
                  <span key={r.id}>
                    {r.analyte.name} {r.valueText} {r.analyte.unit} (usual {r.refText})
                  </span>
                ))}
                {task.reason && !critical ? <span>&ldquo;{task.reason}&rdquo;</span> : null}
                <span className={styles.muted} style={{ fontSize: 14 }}>
                  {task.household.phoneMasked} · made {dateTime(task.createdAt)} · call by{" "}
                  {dateTime(task.dueAt)}
                </span>
                <div className={styles.actions}>
                  <Link
                    className={styles.btnPrimary}
                    href={`/desk/patients/${task.householdId}?show=1#call`}
                    prefetch={false}
                  >
                    Open and call
                  </Link>
                </div>
                <form action={doneTaskAction} className={styles.actions}>
                  <input type="hidden" name="id" value={task.id} />
                  <input type="hidden" name="back" value="/desk/calls" />
                  <label htmlFor={`n-${task.id}`} className="visually-hidden">
                    Note from the call
                  </label>
                  <input
                    id={`n-${task.id}`}
                    name="note"
                    className={styles.input}
                    placeholder="Note from the call"
                    required
                  />
                  <button type="submit" className={styles.btn}>
                    Mark done
                  </button>
                </form>
              </div>
            );
          })}
        </section>

        <section aria-labelledby="flags">
          <h2 id="flags" className={styles.h2}>
            Patient flags ({flags.length})
          </h2>
          {flags.map((flag) => (
            <div key={flag.id} className={styles.card}>
              <span className={styles.kicker}>
                F-{flag.id.slice(-6).toUpperCase()} · {dateTime(flag.createdAt)}
              </span>
              <strong>
                {flag.patient.name} · {flag.report.test.name}
              </strong>
              <span>{flag.kind.replace("_", " ").toLowerCase()}</span>
              {flag.message ? <em>&ldquo;{flag.message}&rdquo;</em> : null}
              <Link href={`/desk/patients/${flag.patient.householdId}`} prefetch={false}>
                Open patient
              </Link>
              <form action={resolveFlagAction} className={styles.actions}>
                <input type="hidden" name="id" value={flag.id} />
                <input type="hidden" name="back" value="/desk/calls" />
                <label htmlFor={`f-${flag.id}`} className="visually-hidden">
                  What was done
                </label>
                <input
                  id={`f-${flag.id}`}
                  name="note"
                  className={styles.input}
                  placeholder="What was done"
                  required
                />
                <button type="submit" className={styles.btn}>
                  Mark resolved
                </button>
              </form>
            </div>
          ))}
        </section>
      </div>
    </DeskShell>
  );
}
