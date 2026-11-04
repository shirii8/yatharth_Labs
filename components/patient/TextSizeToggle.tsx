"use client";

import { useState } from "react";
import styles from "./shell.module.css";

/** Aa: larger text, one tap away on every screen. Remembered for a year in a cookie. */
export function TextSizeToggle({ initial, label }: { initial: boolean; label: string }) {
  const [large, setLarge] = useState(initial);

  function toggle() {
    const next = !large;
    setLarge(next);
    document.documentElement.dataset.text = next ? "large" : "";
    document.cookie = `text=${next ? "large" : "normal"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      className={styles.aa}
      aria-label={label}
      aria-pressed={large}
      onClick={toggle}
    >
      Aa
    </button>
  );
}
