"use client";

import { useActionState } from "react";
import { importAction, type ImportState } from "../actions";
import styles from "../desk.module.css";

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importAction, {
    status: "idle",
  });

  return (
    <>
      <form action={action} className={styles.actions} style={{ marginBottom: 18 }}>
        <label htmlFor="file" className="visually-hidden">
          LIS export file (CSV)
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className={styles.input}
          style={{ paddingTop: 8 }}
        />
        <button type="submit" className={styles.btnPrimary} disabled={pending}>
          {pending ? "Importing" : "Import"}
        </button>
      </form>

      {state.status === "error" ? (
        <p role="alert" className={`${styles.notice} ${styles.error}`}>
          {state.message}
        </p>
      ) : null}

      {state.status === "done" ? (
        <section aria-live="polite">
          <p className={styles.notice}>
            <strong>{state.fileName}</strong>: {state.totalRows} rows. {state.importedRows} new,{" "}
            {state.updatedRows} updated, {state.unchangedRows} unchanged. {state.linksSent} report
            links sent by SMS.{" "}
            {state.criticalTasks > 0
              ? `${state.criticalTasks} critical calls added to Callbacks. `
              : ""}
            {state.errorRows > 0
              ? `${state.errorRows} rows need fixing; the rest imported.`
              : "No rows need fixing."}
          </p>
          {state.errors.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Order</th>
                  <th scope="col">What to fix</th>
                </tr>
              </thead>
              <tbody>
                {state.errors.map((e) => (
                  <tr key={e.rowNumber} style={{ background: "var(--clay-wash)" }}>
                    <td>{e.rowNumber}</td>
                    <td>{e.orderId ?? "missing"}</td>
                    <td>{e.messages.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
