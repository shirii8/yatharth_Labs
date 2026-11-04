import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import styles from "./ui.module.css";

export interface TabItem {
  key: string;
  label: ReactNode;
  href: string;
  current: boolean;
  tint?: string;
  lang?: string;
  ariaLabel?: string;
}

/**
 * The index tab, the brand's motif. The current tab is raised, takes the page
 * colour and merges into the sheet below; the others are tinted and sit lower.
 * Tabs are links with aria-current, so they work without JavaScript.
 */
export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav aria-label={label} className={styles.tabs}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          lang={item.lang}
          aria-label={item.ariaLabel}
          aria-current={item.current ? "page" : undefined}
          className={styles.tab}
          style={{ "--tint": item.tint ?? "var(--sky)" } as CSSProperties}
          prefetch={false}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
