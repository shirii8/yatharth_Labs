import styles from "./desk.module.css";

/** Immediate feedback on the desk while the next screen loads. */
export default function DeskLoading() {
  return (
    <div className={styles.layout}>
      <aside className={styles.side} />
      <main className={styles.sheet} role="status" aria-live="polite">
        <p className={styles.muted}>Loading…</p>
      </main>
    </div>
  );
}
