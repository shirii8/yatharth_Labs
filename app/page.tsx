import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Folder } from "@/components/patient/Drawings";
import { Shell } from "@/components/patient/Shell";
import styles from "@/components/patient/shell.module.css";
import { LanguageTabs } from "@/components/patient/LanguageTabs";
import { NotchRule } from "@/components/ui/NotchRule";
import { currentSession } from "@/lib/auth/cookies";
import { localeFromCookie, messages } from "@/lib/i18n";
import { SignInForm } from "./sign-in-form";

export default async function SignInPage() {
  const session = await currentSession();
  if (session?.kind === "PATIENT") redirect("/family");

  const locale = localeFromCookie((await cookies()).get("lang")?.value);
  const t = messages(locale);

  return (
    <Shell tabs={<LanguageTabs current={locale} next="/" />}>
      <h1 className={styles.hero}>{t.signIn.title}</h1>
      <p className={styles.lede}>{t.signIn.lede}</p>
      <NotchRule />
      <SignInForm t={t.signIn} />
      {process.env.DEMO_MODE === "true" && process.env.DEMO_OTP ? (
        <p
          style={{
            margin: 0,
            padding: "10px 14px",
            border: "2px dashed var(--ink)",
            borderRadius: 12,
            background: "var(--sand)",
            fontSize: "0.85em",
          }}
        >
          <strong>Demo only.</strong> SMS is simulated. Use +91 90000 00001, 00002 or 00003, and the
          code {process.env.DEMO_OTP}.
        </p>
      ) : null}
      <div className={styles.aside}>
        <Folder />
        <span>{t.signIn.safe}</span>
      </div>
    </Shell>
  );
}
