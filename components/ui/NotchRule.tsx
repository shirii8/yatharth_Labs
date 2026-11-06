import styles from "./ui.module.css";

/**
 * A section divider with a small tab-shaped notch: the index tab again.
 * A clean vector line that stays 1.5 px thick at any width.
 */
export function NotchRule() {
  return (
    <svg
      aria-hidden="true"
      className={styles.notch}
      viewBox="0 0 330 14"
      preserveAspectRatio="none"
    >
      <path
        d="M0 12H148L154 3H176L182 12H330"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
