import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DemoHint } from "@/components/patient/DemoHint";
import { Folder } from "@/components/patient/Drawings";
import { LanguageTabs } from "@/components/patient/LanguageTabs";
import { Shell } from "@/components/patient/Shell";
import styles from "@/components/patient/shell.module.css";
import { NotchRule } from "@/components/ui/NotchRule";
import { currentSession } from "@/lib/auth/cookies";
import { localeFromCookie, messages } from "@/lib/i18n";
import { SignInForm } from "./sign-in-form";

/** Sign in. On a laptop: the welcome on the left, the form on the right. */
export default async function SignInPage() {
  const session = await currentSession();
  if (session?.kind === "PATIENT") redirect("/family");

  const locale = localeFromCookie((await cookies()).get("lang")?.value);
  const t = messages(locale);

  return (
    <Shell tabs={<LanguageTabs current={locale} next="/" />}>
      <div className={styles.split} data-even="">
        <div className={styles.col}>
          <h1 className={styles.hero}>{t.signIn.title}</h1>
          <p className={styles.lede}>{t.signIn.lede}</p>
          <NotchRule />
        </div>
        <div className={styles.col}>
          <SignInForm t={t.signIn} />
          <DemoHint />
          <div className={styles.aside} style={{ marginTop: 8 }}>
            <Folder />
            <span>{t.signIn.safe}</span>
          </div>
        </div>
      </div>
    </Shell>
  );
}
