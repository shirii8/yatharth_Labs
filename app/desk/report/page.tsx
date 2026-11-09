import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { DeskShell } from "@/components/staff/DeskShell";
import styles from "@/components/staff/insight.module.css";
import { requireStaff } from "@/lib/auth/staff-guard";
import { opsReport } from "@/lib/staff/ops-report";
import desk from "../desk.module.css";

export const metadata: Metadata = { title: "Delivery report" };

const RANGES = [7, 30, 90] as const;
const TARGET = 0.8; // The brief: 80% of reports delivered digitally.

const pct = (n: number | null) => (n === null ? "No reports yet" : `${Math.round(n * 100)}%`);
const share = (part: number, whole: number) => (whole ? part / whole : 0);

/**
 * The operations head's page: is the lab meeting the brief's targets? Each
 * number says what it measures and what good looks like, in words.
 */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { staff } = await requireStaff("report");
  const { days: daysParam } = await searchParams;
  const days = RANGES.find((d) => String(d) === daysParam) ?? 30;
  const r = await opsReport({ days });
  const wrongPerson = r.flags.wrongPerson + r.otp.locked;

  const funnel = [
    { label: "Signed by the doctor", n: r.signed },
    { label: "Link sent by SMS", n: r.linkSent },
    { label: "SMS delivered", n: r.delivered },
    { label: "Opened online", n: r.opened },
    { label: "Opened within 72 hours", n: r.openedIn72h },
  ];

  return (
    <DeskShell staff={staff} current="/desk/report">
      <div className={styles.head}>
        <div>
          <h1 className={desk.title} style={{ marginBottom: 8 }}>
            Delivery and access
          </h1>
          <p className={styles.lede} style={{ margin: 0 }}>
            Reports signed in the last {days} days, measured against the targets agreed with the
            lab.
          </p>
        </div>
        <nav className={styles.range} aria-label="Time range">
          {RANGES.map((d) => (
            <Link
              key={d}
              href={`/desk/report?days=${d}`}
              aria-current={d === days ? "page" : undefined}
              prefetch={false}
            >
              {d} days
            </Link>
          ))}
        </nav>
      </div>

      {r.signed === 0 ? (
        <p className={desk.notice} role="status">
          No reports were signed in the last {days} days. Import an LIS export, or choose a longer
          range.
        </p>
      ) : null}

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Opened online</span>
          <span className={styles.big}>{pct(r.digitalRate)}</span>
          <div
            className={styles.meter}
            role="img"
            aria-label={`${pct(r.digitalRate)} opened online, target 80%`}
          >
            <div
              className={styles.meterFill}
              style={{ width: `${Math.round((r.digitalRate ?? 0) * 100)}%` }}
            />
            <span className={styles.meterTarget} style={{ left: `${TARGET * 100}%` }} />
          </div>
          <Verdict ok={(r.digitalRate ?? 0) >= TARGET} yes="Target 80% met" no="Below 80% target" />
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Time to first open</span>
          <span className={styles.big}>
            {r.medianHoursToOpen === null ? "None yet" : `${r.medianHoursToOpen} h`}
          </span>
          <span className={styles.sub}>Median, from signing to the patient opening it.</span>
          {r.medianHoursToOpen !== null ? (
            <Verdict
              ok={r.medianHoursToOpen <= 72}
              yes="Inside the 72-hour link"
              no="Slower than the 72-hour link"
            />
          ) : null}
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Critical values called</span>
          <span className={styles.big}>
            {r.critical.called} of {r.critical.total}
          </span>
          <span className={styles.sub}>
            {r.critical.medianMinutesToCall === null
              ? "No calls finished yet."
              : `Median ${r.critical.medianMinutesToCall} minutes to the call.`}
          </span>
          <Verdict
            ok={r.critical.overdue === 0}
            yes="None overdue"
            no={`${r.critical.overdue} overdue: see Callbacks`}
          />
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Wrong-person signals</span>
          <span className={styles.big}>{wrongPerson}</span>
          <span className={styles.sub}>
            &ldquo;Not my name&rdquo; flags plus numbers paused after five wrong codes.
          </span>
          <Verdict ok={wrongPerson === 0} yes="Target: none" no="Look into each one" />
        </div>
      </div>

      <section className={styles.section} aria-labelledby="funnel">
        <h2 id="funnel" className={styles.h2}>
          From signing to reading
        </h2>
        <ol className={styles.funnel}>
          {funnel.map((f, i) => (
            <li key={f.label} className={styles.step}>
              <span>{f.label}</span>
              <div className={styles.track} aria-hidden="true">
                <div
                  className={styles.bar}
                  style={{
                    width: `${Math.round(share(f.n, r.signed) * 100)}%`,
                    animationDelay: `${i * 60}ms`,
                  }}
                />
              </div>
              <span className={styles.num}>
                {f.n}
                <small>{r.signed ? pct(share(f.n, r.signed)) : ""}</small>
              </span>
            </li>
          ))}
        </ol>
        {r.failed > 0 ? (
          <p className={styles.note} style={{ marginTop: 12 }}>
            {r.failed} {r.failed === 1 ? "report's SMS" : "reports' SMS"} failed. Open the patient
            in Patients to check the number and resend.
          </p>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="trend">
        <h2 id="trend" className={styles.h2}>
          Opened online, by the day it was signed
        </h2>
        <Trend days={r.days} />
      </section>

      <div className={styles.grid2}>
        <section aria-labelledby="calls">
          <h2 id="calls" className={styles.h2}>
            Calls the lab still gets
          </h2>
          <dl className={styles.defs}>
            <dt>&ldquo;Call me back&rdquo; requests</dt>
            <dd>{r.callMeBack}</dd>
            <dt>Links resent by the desk</dt>
            <dd>{r.resends}</dd>
            <dt>Signed PDFs downloaded</dt>
            <dd>{r.pdfDownloads}</dd>
            <dt>Patient flags on reports</dt>
            <dd>{r.flags.total}</dd>
          </dl>
          <p className={styles.note} style={{ marginTop: 12 }}>
            The brief&apos;s goal is 60% fewer status calls in 3 months. Compare these with the
            desk&apos;s call count before go-live.
          </p>
        </section>
        <section aria-labelledby="access">
          <h2 id="access" className={styles.h2}>
            Who opened what
          </h2>
          <dl className={styles.defs}>
            <dt>Codes sent</dt>
            <dd>{r.otp.sent}</dd>
            <dt>Codes accepted</dt>
            <dd>{r.otp.verified}</dd>
            <dt>Wrong codes typed</dt>
            <dd>{r.otp.failed}</dd>
            <dt>Numbers paused</dt>
            <dd>{r.otp.locked}</dd>
            <dt>Staff opened a patient</dt>
            <dd>{r.views.staff}</dd>
            <dt>Staff revealed a number</dt>
            <dd>{r.views.phone}</dd>
            <dt>Doctors opened a report</dt>
            <dd>{r.views.doctor}</dd>
          </dl>
          <p className={styles.note} style={{ marginTop: 12 }}>
            From the access log, which cannot be edited or deleted.
          </p>
        </section>
      </div>
    </DeskShell>
  );
}

function Verdict({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span className={styles.verdict} data-ok={ok}>
      {ok ? yes : no}
    </span>
  );
}

/** One bar per day: the share of that day's signed reports opened online. One series, one colour. */
function Trend({ days }: { days: { day: string; signed: number; opened: number }[] }) {
  const label = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  return (
    <>
      <div
        className={styles.trend}
        role="img"
        aria-label="Share of each day's reports opened online"
      >
        <div className={styles.target} style={{ bottom: `${TARGET * 100}%` }}>
          <span>80% target</span>
        </div>
        {days.map((d) => {
          const s = share(d.opened, d.signed);
          return (
            <div
              key={d.day}
              className={styles.day}
              data-empty={d.signed === 0 ? "" : undefined}
              tabIndex={0}
            >
              <div
                className={styles.dayBar}
                style={{ height: d.signed ? `${Math.max(s * 100, 2)}%` : "2px" } as CSSProperties}
              />
              <span className={styles.tip}>
                {label(d.day)}:{" "}
                {d.signed ? `${d.opened} of ${d.signed} opened (${pct(s)})` : "nothing signed"}
              </span>
            </div>
          );
        })}
      </div>
      <div className={styles.axis} aria-hidden="true">
        <span>{label(days[0]!.day)}</span>
        <span>{label(days[days.length - 1]!.day)}</span>
      </div>
      <details className={styles.table}>
        <summary>Show as a table</summary>
        <table className={desk.table} style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Signed</th>
              <th scope="col">Opened online</th>
            </tr>
          </thead>
          <tbody>
            {days
              .filter((d) => d.signed > 0)
              .map((d) => (
                <tr key={d.day}>
                  <td>{label(d.day)}</td>
                  <td>{d.signed}</td>
                  <td>
                    {d.opened} ({pct(share(d.opened, d.signed))})
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
