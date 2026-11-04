import type { Metadata } from "next";
import Link from "next/link";
import { DeskShell } from "@/components/staff/DeskShell";
import { requireStaff } from "@/lib/auth/staff-guard";
import { searchHouseholds } from "@/lib/staff/search";
import styles from "../desk.module.css";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; denied?: string }>;
}) {
  const { staff } = await requireStaff("desk");
  const { q = "", denied } = await searchParams;
  const results = await searchHouseholds(q);

  return (
    <DeskShell staff={staff} current="/desk/patients">
      {denied ? (
        <p className={styles.notice} role="status">
          That page is for the lab admin. Ask them if you need it.
        </p>
      ) : null}
      <form className={styles.search} role="search">
        <label htmlFor="q" className="visually-hidden">
          Search by mobile number, last four digits or name
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Mobile number, last 4 digits, or name"
          autoComplete="off"
          autoFocus
        />
        <button type="submit" className={styles.btnPrimary}>
          Search
        </button>
      </form>

      {q && results.length === 0 ? (
        <p>No one found for &ldquo;{q}&rdquo;. Check the number, or try the last four digits.</p>
      ) : null}
      {!q ? (
        <p className={styles.muted}>
          Search by the full mobile number, its last four digits, or part of a name. Every patient
          you open is written in their access record.
        </p>
      ) : null}

      {results.length > 0 ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Number</th>
              <th scope="col">Family on this number</th>
              <th scope="col">Consent</th>
            </tr>
          </thead>
          <tbody>
            {results.map((h) => (
              <tr key={h.id}>
                <td>
                  <Link href={`/desk/patients/${h.id}`} style={{ fontWeight: 700 }}>
                    {h.phoneMasked}
                  </Link>
                </td>
                <td>{h.patients.map((p) => `${p.name} (${p.age})`).join(", ")}</td>
                <td>{h.consentWithdrawnAt ? "Withdrawn" : h.consentAt ? "Given" : "Not yet"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </DeskShell>
  );
}
