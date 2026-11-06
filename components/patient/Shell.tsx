import { cookies } from "next/headers";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { localeFromCookie, messages } from "@/lib/i18n";
import { CallFooter } from "./CallFooter";
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
  /** Without the sheet, content sits on the desk (the report page has its own cards). */
  sheet?: boolean;
  /** Replaces the lab name with a way back, for example to the family file. */
  back?: { href: string; label: string };
  /** Extra header controls before Aa, for example the Compact switch. */
  actions?: ReactNode;
  /** "narrow" for single-task screens (enter code, notices); "wide" uses the full laptop width. */
  width?: "narrow" | "wide";
}

/** The patient frame: lab name or back link, Aa, tabs, the double-ruled sheet, the call footer. */
export async function Shell({
  children,
  tabs,
  tone = "default",
  mode = "simple",
  footer = true,
  tint,
  sheet = true,
  back,
  actions,
  width = "wide",
}: ShellProps) {
  const jar = await cookies();
  const t = messages(localeFromCookie(jar.get("lang")?.value));
  const labName = process.env.NEXT_PUBLIC_LAB_NAME || "Your lab";

  return (
    <div className={styles.shell} data-width={width}>
      <header className={styles.topbar}>
        {back ? (
          <Link href={back.href} className={styles.back} prefetch={false}>
            <span aria-hidden="true">←</span> {back.label}
          </Link>
        ) : (
          <Link href="/" className={styles.labName} prefetch={false}>
            {labName}
          </Link>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {actions}
          <TextSizeToggle initial={jar.get("text")?.value === "large"} label={t.common.textSize} />
        </div>
      </header>
      {tabs}
      {sheet ? (
        <main
          className={styles.sheet}
          data-tone={tone}
          data-mode={mode}
          style={tint ? ({ "--sheet-bg": tint } as CSSProperties) : undefined}
        >
          {children}
        </main>
      ) : (
        <main className={styles.bare} data-mode={mode}>
          {children}
        </main>
      )}
      {footer ? <CallFooter callLab={t.common.callLab} callMeBack={t.common.callMeBack} /> : null}
    </div>
  );
}
