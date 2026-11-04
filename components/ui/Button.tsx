import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import styles from "./ui.module.css";

function Arrow() {
  return (
    <span aria-hidden="true" className={styles.chip}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

/** The one green button on a screen: the next step. */
export function PrimaryButton({
  children,
  ...props
}: ComponentProps<"button"> & { children: ReactNode }) {
  return (
    <button className={styles.primary} type="submit" {...props}>
      <span>{children}</span>
      <Arrow />
    </button>
  );
}

export function PrimaryLink({
  children,
  ...props
}: ComponentProps<typeof Link> & { children: ReactNode }) {
  return (
    <Link className={styles.primary} {...props}>
      <span>{children}</span>
      <Arrow />
    </Link>
  );
}

/** Everything that is not the next step: ink outline on paper. */
export function OutlineButton({ className, ...props }: ComponentProps<"button">) {
  return <button className={`${styles.outline} ${className ?? ""}`} type="button" {...props} />;
}

export function OutlineLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={`${styles.outline} ${className ?? ""}`} {...props} />;
}

export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={`${styles.textLink} ${className ?? ""}`} {...props} />;
}
