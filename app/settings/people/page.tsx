import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PeopleForm } from "@/components/patient/PeopleForm";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { requireConsentedPatient } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { localeFromCookie, messages } from "@/lib/i18n";

export const metadata: Metadata = { title: "People on this number" };

/** Settings: change how each person on the number is related to the number holder. */
export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { household } = await requireConsentedPatient();
  const t = messages(localeFromCookie((await cookies()).get("lang")?.value));
  const people = await db.patient.findMany({
    where: { householdId: household.id },
    orderBy: { createdAt: "asc" },
  });
  const { error, saved } = await searchParams;

  return (
    <Shell nav back={{ href: "/settings", label: t.people.back }}>
      <div className={shell.split}>
        <div className={shell.col}>
          <h1 className={shell.hero}>{t.people.settingsTitle}</h1>
          <p style={{ margin: 0 }}>{t.people.lede.replace("{phone}", household.phoneMasked)}</p>
        </div>
        <div className={shell.col}>
          <PeopleForm
            people={people}
            t={t.people}
            from="settings"
            error={error}
            saved={saved === "1" && !error}
          />
        </div>
      </div>
    </Shell>
  );
}
