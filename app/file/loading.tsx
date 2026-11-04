import styles from "@/components/patient/shell.module.css";
import { Kettle } from "@/components/patient/Drawings";
import { en } from "@/lib/i18n/en";

/**
 * Shown at once while a file or report is fetched, so a slow 3G connection
 * shows a calm page that says it may take a minute, never a blank screen.
 */
export default function Loading() {
  const copy = en.notice.loading;
  return (
    <div className={styles.shell}>
      <main className={styles.sheet} role="status" aria-live="polite">
        <Kettle size={110} />
        <h1 className={styles.hero} style={{ fontSize: 40, lineHeight: 1.08 }}>
          {copy.title}
        </h1>
        <p style={{ margin: 0 }}>{copy.body}</p>
        <p style={{ margin: "auto 0 0", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
          {copy.sign}
        </p>
      </main>
    </div>
  );
}
