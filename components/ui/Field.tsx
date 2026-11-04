import type { ComponentProps } from "react";
import styles from "./ui.module.css";

interface FieldProps extends ComponentProps<"input"> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  prefix?: string;
}

/** Label above, 62px input, helper below, error in words. */
export function Field({ id, label, hint, error, prefix, ...input }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.inputWrap} data-invalid={error ? "true" : undefined}>
        {prefix ? <span className={styles.prefix}>{prefix}</span> : null}
        <input
          id={id}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
          {...input}
        />
      </div>
      {error ? (
        <span id={errorId} className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
      {hint ? (
        <span id={hintId} className={styles.helper}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
