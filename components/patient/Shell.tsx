import { cookies } from "next/headers";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { LOCALES, LOCALE_LABELS, localeFromCookie, messages } from "@/lib/i18n";
import { CallFooter } from "./CallFooter";
import styles from "./shell.module.css";
import { EasyToggle } from "./EasyToggle";
import { GearIcon, HomeIcon } from "./Icons";
import { Menu } from "./Menu";
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
  /**
   * Signed in with the whole file (not a link, not mid-setup): shows Home, and
   * the menu on phones and tablets or Settings on laptops.
   */
  nav?: boolean;
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
  nav = false,
}: ShellProps) {
  const jar = await cookies();
  const locale = localeFromCookie(jar.get("lang")?.value);
  const t = messages(locale);
  const labName = process.env.NEXT_PUBLIC_LAB_NAME || "Your lab";
  const largeText = jar.get("text")?.value === "large";

  return (
    <div className={styles.shell} data-width={width}>
      <header
        className={styles.topbar}
        data-nav={nav ? "" : undefined}
        data-back={back ? "" : undefined}
      >
        <div className={styles.lead}>
          {/* Home always means one place: "Whose file?", where you choose whose reports to read. */}
          {nav ? (
            <Link href="/family" className={styles.home} prefetch={false}>
              <HomeIcon />
              <span>{t.nav.home}</span>
            </Link>
          ) : null}
          {back ? (
            <Link href={back.href} className={styles.back} prefetch={false}>
              <span aria-hidden="true">←</span> {back.label}
            </Link>
          ) : (
            // The lab's name is a label, not a hidden link: Home does that job, in words.
            <span className={styles.labName}>{labName}</span>
          )}
        </div>
        <div className={styles.actions}>
          {actions}
          {/* On laptops the two call buttons sit up here; phones keep them in the bottom bar. */}
          {footer ? (
            <div className={styles.headerCalls}>
              <CallFooter callLab={t.common.callLab} callMeBack={t.common.callMeBack} inline />
            </div>
          ) : null}
          <EasyToggle initial={jar.get("easy")?.value === "on"} label={t.common.easyView} />
          <span data-advanced="" className={styles.aaSlot}>
            <TextSizeToggle initial={largeText} label={t.common.textSize} />
          </span>
          {nav ? (
            <>
              <Link href="/settings" className={styles.settings} prefetch={false}>
                <GearIcon />
                <span>{t.nav.settings}</span>
              </Link>
              <Menu
                t={t.nav}
                labName={labName}
                languages={LOCALES.map((code) => ({
                  code,
                  label: LOCALE_LABELS[code],
                  current: code === locale,
                }))}
                textSize={<TextSizeToggle initial={largeText} label={t.common.textSize} />}
              />
            </>
          ) : null}
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
      {footer ? (
        <div className={styles.bottomCalls}>
          <CallFooter callLab={t.common.callLab} callMeBack={t.common.callMeBack} />
        </div>
      ) : null}
    </div>
  );
}
