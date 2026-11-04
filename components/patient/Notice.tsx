import type { ReactNode } from "react";
import { PrimaryLink } from "@/components/ui/Button";
import type { Messages } from "@/lib/i18n";
import { DoorAjar, EmptyFolder, FiledPage, Kettle, Lamp } from "./Drawings";
import styles from "./shell.module.css";

export type NoticeKind = keyof Messages["notice"];

const DRAWINGS: Record<NoticeKind, () => ReactNode> = {
  expired: () => <FiledPage size={110} />,
  invalid: () => <EmptyFolder size={110} />,
  timeout: () => <DoorAjar size={110} />,
  loading: () => <Kettle size={110} />,
  empty: () => <EmptyFolder size={110} />,
  error: () => <Lamp size={110} />,
  notFound: () => <EmptyFolder size={110} />,
};

/**
 * One layout for every "something is not as expected" moment: a small drawing,
 * one sentence in serif, what happens next, one button, and a line signed by
 * the front desk. Never a stack trace or an error code alone.
 */
export function Notice({
  kind,
  t,
  ctaHref,
  action,
  code,
}: {
  kind: NoticeKind;
  t: Messages;
  ctaHref?: string;
  /** A button that is not a link, such as "Try again" on the error page. */
  action?: ReactNode;
  code?: string;
}) {
  const copy = t.notice[kind];
  return (
    <div
      className={styles.stack}
      style={{ gap: 20, flex: 1 }}
      role={kind === "loading" ? "status" : undefined}
    >
      {DRAWINGS[kind]()}
      <h1 className={styles.hero} style={{ fontSize: 40, lineHeight: 1.08 }}>
        {copy.title}
      </h1>
      <p style={{ margin: 0 }}>{copy.body}</p>
      {action ??
        (copy.cta && ctaHref ? (
          <PrimaryLink href={ctaHref} prefetch={false}>
            {copy.cta}
          </PrimaryLink>
        ) : null)}
      <p
        style={{
          margin: "auto 0 0",
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          color: "var(--ink-soft)",
        }}
      >
        {copy.sign.replace("{code}", code ?? "R-500")}
        <br />
        {t.common.signedBy}
      </p>
    </div>
  );
}
