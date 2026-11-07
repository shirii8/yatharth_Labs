import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PeopleForm } from "@/components/patient/PeopleForm";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { requireConsentedPatient } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { localeFromCookie, messages } from "@/lib/i18n";

export const metadata: Metadata = { title: "Who is on this number?" };

/**
 * First-time setup, step 2 of 2 (after reading style): the number holder
 * confirms who is on the number. The lab's guesses are filled in, so a family
 * that is already right passes with one tap.
 */
export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { household } = await requireConsentedPatient();
  if (!household.readingMode) redirect("/preference");
  const t = messages(localeFromCookie((await cookies()).get("lang")?.value));
  const people = await db.patient.findMany({
    where: { householdId: household.id },
    orderBy: { createdAt: "asc" },
  });
  const { error } = await searchParams;

  return (
    <Shell>
      <div className={shell.split}>
        <div className={shell.col}>
          <span className={shell.eyebrow}>{t.people.step.replace("{n}", "2")}</span>
          <h1 className={shell.hero} style={{ marginTop: -12 }}>
            {t.people.title}
          </h1>
          <p style={{ margin: 0 }}>{t.people.lede.replace("{phone}", household.phoneMasked)}</p>
        </div>
        <div className={shell.col}>
          <PeopleForm people={people} t={t.people} from="setup" error={error} />
        </div>
      </div>
    </Shell>
  );
}
