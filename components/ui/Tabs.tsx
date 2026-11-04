import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import styles from "./ui.module.css";

export interface TabItem {
  key: string;
  label: ReactNode;
  /** Without an href the tab is a label only, such as "Once only" on consent. */
  href?: string;
  current: boolean;
  tint?: string;
  lang?: string;
  ariaLabel?: string;
}

/**
 * The index tab, the brand's motif. The current tab is raised and merges into
 * the sheet below; the others are tinted and sit lower. Tabs are links with
 * aria-current, so they work without JavaScript.
 */
export function Tabs({
  items,
  label,
  keepTint = false,
}: {
  items: TabItem[];
  label: string;
  /** The current tab keeps its tint, and the sheet takes the same colour. */
  keepTint?: boolean;
}) {
  return (
    <nav aria-label={label} className={styles.tabs}>
      {items.map((item) => {
        const common = {
          lang: item.lang,
          "aria-label": item.ariaLabel,
          className: styles.tab,
          "data-keep-tint": keepTint ? "" : undefined,
          style: { "--tint": item.tint ?? "var(--sky)" } as CSSProperties,
        };
        return item.href ? (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.current ? "page" : undefined}
            prefetch={false}
            {...common}
          >
            {item.label}
          </Link>
        ) : (
          <span
            key={item.key}
            aria-current={item.current ? "step" : undefined}
            data-static=""
            {...common}
          >
            {item.label}
          </span>
        );
      })}
    </nav>
  );
}
