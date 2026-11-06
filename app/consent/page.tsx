import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Shell } from "@/components/patient/Shell";
import { Tabs } from "@/components/ui/Tabs";
import { currentSession } from "@/lib/auth/cookies";
import { db } from "@/lib/db/client";
import { localeFromCookie, messages } from "@/lib/i18n";
import shell from "@/components/patient/shell.module.css";
import styles from "./consent.module.css";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Before we begin" };

/** Consent, once, before the first report (DPDP Act 2023). */
export default async function ConsentPage() {
  const session = await currentSession();
  if (!session?.householdId || session.kind === "STAFF") redirect("/");

  const locale = localeFromCookie((await cookies()).get("lang")?.value);
  const t = messages(locale);
  const household = await db.household.findUniqueOrThrow({
    where: { id: session.householdId },
    include: { patients: { orderBy: { createdAt: "asc" }, take: 1 } },
  });
  const holder = household.patients[0];
  const firstName = holder?.name.split(" ")[0];

  return (
    <Shell
      tabs={
        <Tabs
          label={t.consent.tabBegin}
          items={[
            { key: "begin", label: t.consent.tabBegin, current: true },
            { key: "once", label: t.consent.tabOnce, current: false, tint: "var(--lilac)" },
          ]}
        />
      }
    >
      <div className={shell.split}>
        <div className={shell.col}>
          <p className={styles.greeting}>
            {firstName
              ? t.consent.greeting.replace("{name}", `${firstName} ${t.common.honorific}`)
              : t.consent.greetingNoName}
          </p>
          <h1 className={styles.title}>{t.consent.title}</h1>
          <p style={{ margin: 0 }}>{t.consent.lede}</p>
        </div>
        <div className={shell.col}>
          <ol className={styles.promises}>
            {t.consent.promises.map((p, i) => (
              <li key={p.head} className={styles.promise}>
                <span className={styles.number} aria-hidden="true">
                  {i + 1}
                </span>
                <span>
                  <strong>{p.head}</strong>
                  <span>{p.body}</span>
                </span>
              </li>
            ))}
          </ol>
          <ConsentForm t={t.consent} />
          <p className={styles.footnote}>
            {t.consent.footer} {t.common.signedBy}.
          </p>
        </div>
      </div>
    </Shell>
  );
}
