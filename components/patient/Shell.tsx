import { cookies } from "next/headers";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { localeFromCookie, messages } from "@/lib/i18n";
import { CallFooter } from "./CallFooter";
import { HandFilter } from "./Drawings";
import styles from "./shell.module.css";
import { TextSizeToggle } from "./TextSizeToggle";

interface ShellProps {
  children: ReactNode;
  /** A row of index tabs sitting on top of the sheet. */
  tabs?: ReactNode;
  /** "call" is the muted rose page used only for "Please call us". */
  tone?: "default" | "call";
  mode?: "simple" | "compact";
  /** The call footer is on every patient screen; only print views hide it. */
  footer?: boolean;
  /** Sheet colour when the selected tab's tint carries into the page (family file). */
  tint?: string;
}

/** The patient frame: lab name, Aa, optional tabs, the double-ruled sheet, the call footer. */
export async function Shell({
  children,
  tabs,
  tone = "default",
  mode = "simple",
  footer = true,
  tint,
}: ShellProps) {
  const jar = await cookies();
  const t = messages(localeFromCookie(jar.get("lang")?.value));
  const labName = process.env.NEXT_PUBLIC_LAB_NAME || "Your lab";

  return (
    <div className={styles.shell}>
      <HandFilter />
      <header className={styles.topbar}>
        <Link href="/" className={styles.labName} prefetch={false}>
          {labName}
        </Link>
        <TextSizeToggle initial={jar.get("text")?.value === "large"} label={t.common.textSize} />
      </header>
      {tabs}
      <main
        className={styles.sheet}
        data-tone={tone}
        data-mode={mode}
        style={tint ? ({ "--sheet-bg": tint } as CSSProperties) : undefined}
      >
        {children}
      </main>
      {footer ? <CallFooter callLab={t.common.callLab} callMeBack={t.common.callMeBack} /> : null}
    </div>
  );
}
