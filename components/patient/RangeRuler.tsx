import type { CSSProperties } from "react";
import styles from "./ruler.module.css";

/**
 * The reference range as a ruler: a line, a sage band for the usual range with
 * its printed numbers, and a green "You" tab where the patient's value sits.
 * Every position comes from the printed range and the value, never from a model.
 * One image to a screen reader, with a full sentence as its label.
 */

const LEFT = 6;
const RIGHT = 314;
const WIDTH = RIGHT - LEFT;

export function rulerScale(value: number, low: number | null, high: number | null) {
  let min: number;
  let max: number;
  if (low !== null && high !== null) {
    const span = Math.max(high - low, Math.abs(high) * 0.1, 0.1);
    min = low - span * 0.6;
    max = high + span * 0.6;
  } else if (high !== null) {
    min = Math.min(0, value);
    max = high * 1.5;
  } else if (low !== null) {
    min = low * 0.4;
    max = low * 2;
  } else {
    min = value * 0.5;
    max = value * 1.5 || 1;
  }
  const pad = (max - min) * 0.08;
  min = Math.min(min, value - pad);
  max = Math.max(max, value + pad);
  const x = (v: number) => LEFT + ((v - min) / (max - min)) * WIDTH;
  return { x, min, max };
}

export function RangeRuler({
  value,
  low,
  high,
  usualLabel,
  youLabel,
  ariaLabel,
  animate = true,
}: {
  value: number;
  low: number | null;
  high: number | null;
  usualLabel: string;
  youLabel: string;
  ariaLabel: string;
  animate?: boolean;
}) {
  const { x } = rulerScale(value, low, high);
  const bandStart = low !== null ? x(low) : LEFT;
  const bandEnd = high !== null ? x(high) : RIGHT;
  const you = Math.min(Math.max(x(value), 30), RIGHT - 24);
  const ticks = Array.from({ length: 9 }, (_, i) => LEFT + (WIDTH / 8) * i);

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox="0 0 320 96"
      width="100%"
      className={animate ? styles.ruler : `${styles.ruler} ${styles.still}`}
      style={{ "--you-from": `${LEFT - you}px` } as CSSProperties}
    >
      <text x={(bandStart + bandEnd) / 2} y="16" textAnchor="middle" className={styles.usual}>
        {usualLabel}
      </text>
      <path
        className={styles.line}
        d={`M${LEFT} 44 H${RIGHT}`}
        pathLength={1}
        stroke="var(--ink)"
        strokeWidth="2"
        fill="none"
      />
      {ticks.map((t) => (
        <path key={t} d={`M${t} 40 V48`} stroke="var(--ink)" strokeWidth="1.2" />
      ))}
      <rect
        className={styles.band}
        x={bandStart}
        y="36"
        width={Math.max(bandEnd - bandStart, 4)}
        height="16"
        rx="8"
        fill="var(--sage)"
        stroke="var(--ink)"
        strokeWidth="1.6"
      />
      <g className={styles.you}>
        <path d={`M${you} 44 V60`} stroke="var(--green)" strokeWidth="2.5" />
        <rect x={you - 24} y="60" width="48" height="28" rx="4" fill="var(--green)" />
        <text x={you} y="79" textAnchor="middle" className={styles.youText}>
          {youLabel}
        </text>
      </g>
    </svg>
  );
}
