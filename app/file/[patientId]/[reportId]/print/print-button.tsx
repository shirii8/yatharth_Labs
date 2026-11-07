"use client";

import styles from "./print.module.css";

/** Opens the print dialog. Hidden on the printed page itself. */
export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className={styles.printButton} onClick={() => window.print()}>
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      >
        <path d="M7 9V3h10v6M7 17H4v-8h16v8h-3M7 14h10v7H7z" />
      </svg>
      {label}
    </button>
  );
}
