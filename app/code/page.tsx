import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { TextLink } from "@/components/ui/Button";
import uiStyles from "@/components/ui/ui.module.css";
import { NotchRule } from "@/components/ui/NotchRule";
import { pendingPhone } from "@/lib/auth/cookies";
import { codeStatus } from "@/lib/auth/otp-service";
import { maskPhone } from "@/lib/domain/phone";
import { localeFromCookie, messages } from "@/lib/i18n";
import { CodeForm } from "./code-form";
import styles from "./code.module.css";

export const metadata: Metadata = { title: "Enter your code" };

function Hourglass() {
  return (
    <svg
      aria-hidden="true"
      width="110"
      height="96"
      viewBox="0 0 120 96"
      fill="none"
      stroke="var(--ink)"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g filter="url(#hand)">
        <path d="M36 8h48M36 88h48M40 8v14l20 24-20 24v18M80 8v14L60 46l20 24v18" />
        <path d="M48 80h24l-12-10z" stroke="var(--green)" />
      </g>
    </svg>
  );
}

export default async function CodePage() {
  const phone = await pendingPhone();
  if (!phone) redirect("/");

  const t = messages(localeFromCookie((await cookies()).get("lang")?.value));
  const status = await codeStatus(phone);

  if (status.lockedUntil) {
    const at = status.lockedUntil.toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
    return (
      <Shell>
        <Hourglass />
        <h1 className={styles.title}>{t.code.lockedTitle}</h1>
        <p style={{ margin: 0 }}>{t.code.lockedBody}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>{t.code.tryAt}</span>
          <span className={styles.bigTime}>{at}</span>
        </div>
        <a className={uiStyles.outline} href={`tel:${process.env.NEXT_PUBLIC_LAB_PHONE ?? ""}`}>
          {t.code.callInstead}
        </a>
        <p className={styles.sign}>
          {t.code.lockedSign}
          <br />
          {t.common.signedBy}
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className={styles.title}>{t.code.title}</h1>
      <p style={{ margin: "-8px 0 0" }}>{t.code.sentTo.replace("{phone}", maskPhone(phone))}</p>
      <CodeForm t={t.code} resendAt={status.resendAt?.toISOString() ?? null} />
      <NotchRule />
      <p className={styles.note}>{t.code.note}</p>
      <div className={shell.stack} style={{ marginTop: "auto" }}>
        <TextLink href="/">{t.code.startOver}</TextLink>
      </div>
    </Shell>
  );
}
