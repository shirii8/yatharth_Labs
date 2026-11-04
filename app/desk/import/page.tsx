import type { Metadata } from "next";
import { DeskShell } from "@/components/staff/DeskShell";
import { requireStaff } from "@/lib/auth/staff-guard";
import { db } from "@/lib/db/client";
import { dateTime } from "@/lib/patient-format";
import styles from "../desk.module.css";
import { ImportForm } from "./form";

export const metadata: Metadata = { title: "Import results" };

/** Upload an LIS export. Good rows import, bad rows are listed with what to fix. */
export default async function ImportPage() {
  const { staff } = await requireStaff("import");
  const batches = await db.importBatch.findMany({ orderBy: { createdAt: "desc" }, take: 10 });

  return (
    <DeskShell staff={staff} current="/desk/import">
      <h1 className={styles.title}>Import results</h1>
      <p className={styles.muted} style={{ marginTop: 0 }}>
        Upload the CSV the LIS exports. Signed reports get a link by SMS at once. Uploading the same
        file again changes nothing.
      </p>
      <ImportForm />
      <h2 className={styles.h2}>Recent imports</h2>
      {batches.length === 0 ? <p className={styles.muted}>No files imported yet.</p> : null}
      {batches.length > 0 ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">When</th>
              <th scope="col">File</th>
              <th scope="col">From</th>
              <th scope="col">Rows</th>
              <th scope="col">Imported or updated</th>
              <th scope="col">Need fixing</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td>{dateTime(b.createdAt)}</td>
                <td>{b.fileName}</td>
                <td>{b.source === "FOLDER" ? "Export folder" : "Upload"}</td>
                <td>{b.totalRows}</td>
                <td>{b.importedRows}</td>
                <td
                  style={{
                    color: b.errorRows ? "var(--clay)" : undefined,
                    fontWeight: b.errorRows ? 700 : 400,
                  }}
                >
                  {b.errorRows}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </DeskShell>
  );
}
