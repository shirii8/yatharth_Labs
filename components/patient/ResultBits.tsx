import type { ReactNode } from "react";
import styles from "./result.module.css";

/**
 * The small pieces every result display shares: a mark, a pill and a row.
 * Status is always a word plus a mark, never colour alone, so it reads in
 * black and white and for colour-blind readers.
 */

export type Tone = "usual" | "low" | "high" | "call" | "waiting";

export function toneOf(flag: "LOW" | "USUAL" | "HIGH"): Tone {
  return flag === "LOW" ? "low" : flag === "HIGH" ? "high" : "usual";
}

export function Mark({ tone, size = 14 }: { tone: Tone; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true as const };
  switch (tone) {
    case "usual":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8.5l3.2 3L13 4.5" />
        </svg>
      );
    case "low":
      return (
        <svg {...common} fill="currentColor">
          <path d="M2 4h12L8 13z" />
        </svg>
      );
    case "high":
      return (
        <svg {...common} fill="currentColor">
          <path d="M2 12h12L8 3z" />
        </svg>
      );
    case "waiting":
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.5V8l2.5 1.5" />
        </svg>
      );
    case "call":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 2.5h2.5l1.2 3-1.8 1.2a7 7 0 0 0 3.4 3.4l1.2-1.8 3 1.2V12a1.5 1.5 0 0 1-1.5 1.5A10 10 0 0 1 2.5 4 1.5 1.5 0 0 1 4 2.5" />
        </svg>
      );
  }
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={styles.pill} data-tone={tone}>
      <Mark tone={tone} size={12} />
      {children}
    </span>
  );
}

/** One result as a tinted row: mark, name, value. */
export function ResultRow({
  tone,
  name,
  value,
  index = 0,
}: {
  tone: Tone;
  name: string;
  value: string;
  index?: number;
}) {
  return (
    <li className={styles.row} data-tone={tone} style={{ animationDelay: `${index * 60}ms` }}>
      <Mark tone={tone} />
      <span className={styles.rowName}>{name}</span>
      <span className={styles.rowValue}>{value}</span>
    </li>
  );
}

/**
 * A small horizontal ruler for printouts and cards: the usual band with the
 * value's marker. Positions come from the printed range only.
 */
export function MiniRuler({
  value,
  low,
  high,
  label,
}: {
  value: number;
  low: number | null;
  high: number | null;
  label: string;
}) {
  const lo = low ?? 0;
  const hi = high ?? (low !== null ? low * 2 : value * 1.5 || 1);
  const span = Math.max(hi - lo, Math.abs(hi) * 0.1, 0.1);
  const min = Math.min(lo - span * 0.6, value - span * 0.1);
  const max = Math.max(hi + span * 0.6, value + span * 0.1);
  const pct = (v: number) => Math.min(96, Math.max(4, ((v - min) / (max - min)) * 100));
  const bandStart = low === null ? 0 : pct(lo);
  const bandEnd = high === null ? 100 : pct(hi);
  return (
    <span className={styles.mini}>
      <span className={styles.miniTrack} aria-hidden="true">
        <span
          className={styles.miniBand}
          style={{ left: `${bandStart}%`, width: `${bandEnd - bandStart}%` }}
        />
        <span className={styles.miniDot} style={{ left: `${pct(value)}%` }} />
      </span>
      <span className={styles.miniLabel}>{label}</span>
    </span>
  );
}
