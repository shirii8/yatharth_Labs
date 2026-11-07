import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeskShell } from "@/components/staff/DeskShell";
import { can } from "@/lib/auth/roles";
import { requireStaff } from "@/lib/auth/staff-guard";
import { db } from "@/lib/db/client";
import { decryptPhone } from "@/lib/domain/phone";
import { isLinkValid } from "@/lib/domain/tokens";
import { env } from "@/lib/env";
import { dateTime } from "@/lib/patient-format";
import { doneTaskAction, resendAction, resolveFlagAction } from "../../actions";
import styles from "../../desk.module.css";

export const metadata: Metadata = { title: "Patient desk" };

const MESSAGES: Record<string, string> = {
  sent: "A new link was sent. The old one no longer works.",
  "not-signed": "That report is not signed yet, so there is no link to send.",
  "no-consent": "This number withdrew consent, so no link was sent.",
  added: "Family member added to this number.",
  "note-needed": "Please write a short note before marking it done.",
};

const FLAG_WORDS: Record<string, string> = {
  NOT_MINE: "This is not my report",
  NAME_AGE: "The name or age is wrong",
  VALUE: "A value looks different from what I expected",
  OTHER: "Something else",
};

export default async function PatientDeskPage({
  params,
  searchParams,
}: {
  params: Promise<{ householdId: string }>;
  searchParams: Promise<{ show?: string; msg?: string }>;
}) {
  const { staff } = await requireStaff("desk");
  const { householdId } = await params;
  const { show, msg } = await searchParams;

  const household = await db.household.findUnique({
    where: { id: householdId },
    include: {
      patients: {
        orderBy: { createdAt: "asc" },
        include: {
          reports: {
            orderBy: { createdAt: "desc" },
            include: {
              test: true,
              links: { orderBy: { createdAt: "desc" }, take: 1 },
              results: { include: { analyte: true } },
            },
          },
        },
      },
      callbackTasks: {
        where: { status: "OPEN" },
        orderBy: [{ type: "asc" }, { dueAt: "asc" }],
        include: {
          patient: true,
          report: { include: { test: true, results: { include: { analyte: true } } } },
        },
      },
    },
  });
  if (!household) notFound();

  // Opening a patient's record is itself written in their access record.
  const reveal = show === "1" && can(staff.role, "viewPhone");
  await db.accessLog.createMany({
    data: [
      { actorType: "STAFF", actorId: staff.id, action: "STAFF_VIEWED_PATIENT", householdId },
      ...(reveal
        ? [
            {
              actorType: "STAFF" as const,
              actorId: staff.id,
              action: "STAFF_VIEWED_PHONE" as const,
              householdId,
            },
          ]
        : []),
    ],
  });
  const fullNumber = reveal ? decryptPhone(household.phoneCipher, env().PHONE_ENC_KEY) : null;

  const reportIds = household.patients.flatMap((p) => p.reports.map((r) => r.id));
  const flags = await db.patientFlag.findMany({
    where: { reportId: { in: reportIds }, status: "OPEN" },
    include: { report: { include: { test: true } }, patient: true },
    orderBy: { createdAt: "desc" },
  });
  const log = await db.accessLog.findMany({
    where: { householdId },
    orderBy: { at: "desc" },
    take: 30,
  });
  const staffNames = new Map(
    (
      await db.staffUser.findMany({
        where: { id: { in: log.map((l) => l.actorId).filter((x): x is string => !!x) } },
      })
    ).map((s) => [s.id, s.name]),
  );
  const reportNames = new Map(
    household.patients.flatMap((p) => p.reports.map((r) => [r.id, r.test.name] as const)),
  );

  const [holder, ...others] = household.patients;
  const back = `/desk/patients/${householdId}`;
  const now = new Date();

  return (
    <DeskShell staff={staff} current="/desk/patients">
      <form className={styles.search} role="search" action="/desk/patients">
        <label htmlFor="q" className="visually-hidden">
          Search
        </label>
        <input id="q" name="q" placeholder="Mobile number, last 4 digits, or name" />
        <button type="submit" className={styles.btn}>
          Search
        </button>
      </form>
      {msg && MESSAGES[msg] ? (
        <p className={styles.notice} role="status">
          {MESSAGES[msg]}
        </p>
      ) : null}

      <div className={styles.columns}>
        <div>
          <h1 className={styles.title}>
            {holder ? `${holder.name}, ${holder.age}` : household.phoneMasked}
          </h1>
          <p style={{ margin: "0 0 4px" }}>
            {fullNumber ? (
              <a id="call" href={`tel:${fullNumber}`} style={{ fontWeight: 700 }}>
                {fullNumber}
              </a>
            ) : (
              household.phoneMasked
            )}{" "}
            ·{" "}
            {household.consentWithdrawnAt
              ? `consent withdrawn ${dateTime(household.consentWithdrawnAt)}`
              : household.consentAt
                ? `consent given ${dateTime(household.consentAt)}`
                : "consent not given yet"}{" "}
            · reads in {household.readingMode === "COMPACT" ? "Compact" : "Simple"} mode,{" "}
            {{ EN: "English", TE: "Telugu", HI: "Hindi" }[household.language]}
          </p>
          {others.length > 0 ? (
            <p className={styles.muted} style={{ margin: "0 0 12px" }}>
              Same number: {others.map((p) => `${p.name} (${p.age}, ${p.relation})`).join(", ")}
            </p>
          ) : null}
          <div className={styles.actions}>
            {can(staff.role, "addFamily") ? (
              <Link className={styles.btn} href={`${back}/add`} prefetch={false}>
                Add a family member
              </Link>
            ) : null}
            {!fullNumber && can(staff.role, "viewPhone") ? (
              <Link className={styles.btn} href={`${back}?show=1#call`} prefetch={false}>
                Show full number (logged)
              </Link>
            ) : null}
          </div>

          <h2 className={styles.h2}>Reports and delivery</h2>
          {household.patients.flatMap((p) => p.reports).length === 0 ? (
            <p className={styles.muted}>No reports on this number yet.</p>
          ) : null}
          {household.patients.flatMap((patient) =>
            patient.reports.map((report) => {
              const link = report.links[0];
              const open = link ? isLinkValid(link, now) : false;
              return (
                <div key={report.id} className={styles.row}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong
                        style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 500 }}
                      >
                        {report.test.name}
                      </strong>{" "}
                      <span className={styles.muted}>for {patient.name}</span>
                      <div className={styles.muted} style={{ fontSize: 15 }}>
                        {report.orderId}
                        {report.status === "SIGNED"
                          ? ` · signed ${report.signedAt ? dateTime(report.signedAt) : ""}`
                          : " · with the lab doctor"}
                        {link
                          ? open
                            ? ` · open until ${dateTime(link.expiresAt)}`
                            : " · link closed"
                          : ""}
                        {report.hasCritical ? " · critical value" : ""}
                      </div>
                    </div>
                    <div className={styles.statuses}>
                      {report.status !== "SIGNED" ? <span>◷ Waiting for signature</span> : null}
                      {link?.sentAt ? <span>✓ SMS sent {dateTime(link.sentAt)}</span> : null}
                      {link?.deliveredAt ? (
                        <span>✓ Delivered {dateTime(link.deliveredAt)}</span>
                      ) : null}
                      {link?.deliveryStatus === "FAILED" ? <span>✗ SMS failed</span> : null}
                      {link?.firstOpenedAt ? (
                        <span>◉ Opened {dateTime(link.firstOpenedAt)}</span>
                      ) : link ? (
                        <span>○ Not opened yet</span>
                      ) : null}
                      {link && !open ? <span>◷ Link closed</span> : null}
                    </div>
                  </div>
                  {report.status === "SIGNED" && can(staff.role, "resend") ? (
                    <form action={resendAction} style={{ marginTop: 12 }}>
                      <input type="hidden" name="reportId" value={report.id} />
                      <input type="hidden" name="householdId" value={householdId} />
                      <button type="submit" className={styles.btn}>
                        Resend link
                      </button>
                    </form>
                  ) : null}
                </div>
              );
            }),
          )}

          {flags.map((flag) => (
            <div key={flag.id} className={styles.card} style={{ marginTop: 20 }}>
              <span className={styles.kicker}>
                Patient flag · F-{flag.id.slice(-6).toUpperCase()} · {dateTime(flag.createdAt)}
              </span>
              <strong>
                &ldquo;{FLAG_WORDS[flag.kind] ?? flag.kind}&rdquo; · {flag.report.test.name} ·{" "}
                {flag.patient.name}
              </strong>
              {flag.message ? <em>&ldquo;{flag.message}&rdquo;</em> : null}
              <form action={resolveFlagAction} className={styles.actions}>
                <input type="hidden" name="id" value={flag.id} />
                <input type="hidden" name="back" value={back} />
                <label htmlFor={`note-${flag.id}`} className="visually-hidden">
                  What was done
                </label>
                <input
                  id={`note-${flag.id}`}
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

          <h2 className={styles.h2}>Access log</h2>
          <p className={styles.muted} style={{ marginTop: -8 }}>
            The same record the patient sees under &ldquo;Every opening&rdquo;, plus system steps.
          </p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">What happened</th>
                <th scope="col">Report</th>
                <th scope="col">By</th>
              </tr>
            </thead>
            <tbody>
              {log.map((row) => (
                <tr key={String(row.id)}>
                  <td style={{ whiteSpace: "nowrap" }}>{dateTime(row.at)}</td>
                  <td>{row.action.replaceAll("_", " ").toLowerCase()}</td>
                  <td>{row.reportId ? (reportNames.get(row.reportId) ?? "") : ""}</td>
                  <td>
                    {row.actorType === "STAFF"
                      ? (staffNames.get(row.actorId ?? "") ?? "Staff")
                      : row.actorType === "SYSTEM"
                        ? "LIS import"
                        : `Patient, phone ${household.phoneMasked.slice(-5)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside aria-labelledby="callbacks">
          <h2 id="callbacks" className={styles.h2} style={{ marginTop: 0 }}>
            Callbacks
          </h2>
          {household.callbackTasks.length === 0 ? (
            <p className={styles.muted}>No calls waiting for this number.</p>
          ) : null}
          {household.callbackTasks.map((task) => {
            const critical = task.type === "CRITICAL";
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
                </span>
                <strong style={{ fontFamily: "var(--font-serif)", fontSize: 20, fontWeight: 500 }}>
                  {task.patient
                    ? `${task.patient.name}, ${task.patient.age}`
                    : household.phoneMasked}
                </strong>
                {values.map((r) => (
                  <span key={r.id}>
                    {r.analyte.name} {r.valueText} {r.analyte.unit} (usual {r.refText})
                  </span>
                ))}
                {task.reason && !critical ? <span>&ldquo;{task.reason}&rdquo;</span> : null}
                <span className={styles.muted} style={{ fontSize: 14 }}>
                  Made {dateTime(task.createdAt)} · call by {dateTime(task.dueAt)}
                </span>
                <div className={styles.actions}>
                  <Link className={styles.btnPrimary} href={`${back}?show=1#call`} prefetch={false}>
                    Call now
                  </Link>
                </div>
                <form action={doneTaskAction} className={styles.actions}>
                  <input type="hidden" name="id" value={task.id} />
                  <input type="hidden" name="back" value={back} />
                  <label htmlFor={`done-${task.id}`} className="visually-hidden">
                    Note from the call
                  </label>
                  <input
                    id={`done-${task.id}`}
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
        </aside>
      </div>
    </DeskShell>
  );
}
