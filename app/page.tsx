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
      <div className={styles.aside}>
        <Folder />
        <span>{t.signIn.safe}</span>
      </div>
    </Shell>
  );
}
