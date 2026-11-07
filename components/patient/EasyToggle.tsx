"use client";

import { useState } from "react";
import styles from "./shell.module.css";

/**
 * "Easy view" for older readers: bigger text and only the essential buttons on
 * every screen. A real switch (aria-pressed), remembered for a year. It changes
 * the page at once with no reload, because the simplification is pure CSS.
 */
export function EasyToggle({ initial, label }: { initial: boolean; label: string }) {
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
    <button type="button" className={styles.easy} aria-pressed={on} onClick={toggle}>
      <span className={styles.switch} aria-hidden="true">
        <span className={styles.knob} />
      </span>
      {label}
    </button>
  );
}
