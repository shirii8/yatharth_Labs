"use client";

import { useState } from "react";
import styles from "./shell.module.css";

/**
 * "Easy view" for older readers: bigger text and only the essential buttons on
 * every screen. A real switch (aria-pressed), remembered for a year. It changes
 * the page at once with no reload, because the simplification is pure CSS.
 */
export function EasyToggle({
  initial,
  label,
  states,
}: {
  initial: boolean;
  label: string;
  /** Inside a labelled row the switch shows its state instead of repeating the label. */
  states?: { on: string; off: string };
}) {
  const [on, setOn] = useState(initial);

  function toggle() {
    const next = !on;
    setOn(next);
    const html = document.documentElement;
    if (next) {
      html.dataset.easy = "on";
      html.dataset.text = "large";
    } else {
      delete html.dataset.easy;
    }
    document.cookie = `easy=${next ? "on" : "off"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      className={styles.easy}
      aria-pressed={on}
      aria-label={states ? label : undefined}
      onClick={toggle}
    >
      <span className={styles.switch} aria-hidden="true">
        <span className={styles.knob} />
      </span>
      {states ? (on ? states.on : states.off) : label}
    </button>
  );
}
