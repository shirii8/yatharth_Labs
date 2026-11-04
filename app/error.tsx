"use client";

import { useEffect } from "react";
import { en } from "@/lib/i18n/en";
import styles from "@/components/patient/shell.module.css";
import uiStyles from "@/components/ui/ui.module.css";
import { Lamp } from "@/components/patient/Drawings";

/**
 * Something on our side failed. The patient sees a calm page and a short
 * reference to quote on the phone, never a stack trace. The reference is
 * Next.js's error digest, which matches the server log line.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const copy = en.notice.error;
  const code = `R-${(error.digest ?? "500").slice(0, 6)}`;

  return (
    <div className={styles.shell}>
      <main className={styles.sheet}>
        <Lamp size={110} />
        <h1 className={styles.hero} style={{ fontSize: 40, lineHeight: 1.08 }}>
          {copy.title}
        </h1>
        <p style={{ margin: 0 }}>{copy.body}</p>
        <button type="button" className={uiStyles.primary} onClick={reset}>
          <span>{copy.cta}</span>
        </button>
        <a className={uiStyles.outline} href={`tel:${process.env.NEXT_PUBLIC_LAB_PHONE ?? ""}`}>
          {en.common.callLab}
        </a>
        <p style={{ margin: "auto 0 0", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
          {copy.sign.replace("{code}", code)}
          <br />
          {en.common.signedBy}
        </p>
      </main>
    </div>
  );
}
