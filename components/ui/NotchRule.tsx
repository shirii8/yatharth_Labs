import styles from "./ui.module.css";

/** A section divider with a small tab-shaped notch: the index tab again. */
export function NotchRule() {
  return (
    <svg
      aria-hidden="true"
      className={styles.notch}
      viewBox="0 0 330 14"
      preserveAspectRatio="none"
    >
      <path
        d="M1 12H150Q154 12 156 3H184Q186 12 190 12H329"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.6"
        strokeLinecap="round"
        filter="url(#hand)"
      />
    </svg>
  );
}
