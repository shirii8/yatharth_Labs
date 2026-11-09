import type { Metadata } from "next";
import Link from "next/link";
import { DeskShell } from "@/components/staff/DeskShell";
import styles from "@/components/staff/insight.module.css";
import { requireStaff } from "@/lib/auth/staff-guard";
import { db } from "@/lib/db/client";
import { DOCTOR_WINDOW_DAYS, doctorReports, stateOf } from "@/lib/doctor/reports";
import { dateTime } from "@/lib/patient-format";
import desk from "../desk.module.css";

export const metadata: Metadata = { title: "My patients' reports" };

/**
 * The referring doctor's one place: every report for their patients from the
 * last 90 days. Critical values first, then reports still being prepared,
 * then the newest. Out-of-range values are written in the row, so most
 * reports need no click at all.
 */
export default async function DoctorPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; denied?: string }>;
}) {
  const { staff } = await requireStaff("doctorReports");
  const { q = "", denied } = await searchParams;
  const rows = await doctorReports(staff, { q });
  const doctor = staff.doctorId
    ? await db.referringDoctor.findUnique({ where: { id: staff.doctorId } })
    : null;
  const count = (tone: string) => rows.filter((r) => stateOf(r).tone === tone).length;

  return (
    <DeskShell staff={staff} current="/desk/doctor">
      {denied ? (
        <p className={desk.notice} role="status">
          That page is for lab staff. Your patients&apos; reports are all here.
        </p>
      ) : null}
      <h1 className={desk.title} style={{ marginBottom: 8 }}>
        Your patients&apos; reports
      </h1>
      <p className={styles.lede}>
        {doctor?.name ?? staff.name} · the last {DOCTOR_WINDOW_DAYS} days. Every report you open is
        written in the patient&apos;s access record.
      </p>

      {!q && rows.length > 0 ? (
        <div className={styles.tiles}>
          <Tile
            label="Critical values"
            n={count("critical")}
            note="The lab calls the patient too."
          />
          <Tile label="Outside usual range" n={count("outside")} />
          <Tile label="Being prepared" n={count("waiting")} />
          <Tile label="All in usual range" n={count("usual")} />
        </div>
      ) : null}

      <form className={desk.search} role="search">
        <label htmlFor="q" className="visually-hidden">
          Search by patient name or order number
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Patient name or order number"
          autoComplete="off"
        />
        <button type="submit" className={desk.btnPrimary}>
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <p className={desk.muted}>
          {q
            ? `No report matches "${q}". Try part of the name, or the order number.`
            : `No reports for your patients in the last ${DOCTOR_WINDOW_DAYS} days. New ones appear here as soon as the lab signs them.`}
        </p>
      ) : (
        <table className={desk.table}>
          <thead>
            <tr>
              <th scope="col">Patient</th>
              <th scope="col">Test</th>
              <th scope="col">State</th>
              <th scope="col">Values outside the range</th>
              <th scope="col">Signed</th>
              <th scope="col">
                <span className="visually-hidden">Open</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const state = stateOf(r);
              const outside = r.results.filter((x) => x.flag !== "USUAL" || x.isCritical);
              return (
                <tr
                  key={r.id}
                  className={state.tone === "critical" ? styles.rowCritical : undefined}
                >
                  <td>
                    <strong>{r.patient.name}</strong>
                    <br />
                    <span className={desk.muted}>
                      {r.patient.age} · {r.patient.sex.toLowerCase()} · {r.orderId}
                    </span>
                  </td>
                  <td>{r.test.name}</td>
                  <td>
                    <span className={styles.pill} data-tone={state.tone}>
                      {state.word}
                    </span>
                  </td>
                  <td>
                    {r.status !== "SIGNED" ? (
                      <span className={desk.muted}>Not signed yet</span>
                    ) : outside.length === 0 ? (
                      <span className={desk.muted}>None</span>
                    ) : (
                      <span className={styles.values}>
                        {outside.map((x) => (
                          <span key={x.id}>
                            {x.analyte.name}{" "}
                            <span className={styles.hi}>
                              {x.valueText} {x.flag === "LOW" ? "L" : x.flag === "HIGH" ? "H" : ""}
                            </span>
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td>{r.signedAt ? dateTime(r.signedAt) : "–"}</td>
                  <td>
                    {r.status === "SIGNED" ? (
                      <Link href={`/desk/doctor/${r.id}`} className={styles.open} prefetch={false}>
                        Open report →
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </DeskShell>
  );
}

function Tile({ label, n, note }: { label: string; n: number; note?: string }) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.big}>{n}</span>
      {note ? <span className={styles.sub}>{note}</span> : null}
    </div>
  );
}
