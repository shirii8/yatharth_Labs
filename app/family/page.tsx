import type { Metadata } from "next";
import { cookies } from "next/headers";
import { FamilyTabs } from "@/components/patient/FamilyTabs";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { PrimaryLink, TextLink } from "@/components/ui/Button";
import { NotchRule } from "@/components/ui/NotchRule";
import { requireConsentedPatient } from "@/lib/auth/guards";
import { localeFromCookie, messages } from "@/lib/i18n";
import { familyOverview } from "@/lib/patient/family";
import { firstName, signedWhen } from "@/lib/patient-format";

export const metadata: Metadata = { title: "Whose file?" };

/** "Whose file?": one index tab per family member on this number. */
export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { session } = await requireConsentedPatient();
  const t = messages(localeFromCookie((await cookies()).get("lang")?.value));
  const people = await familyOverview(session);
  const { p } = await searchParams;
  const selected = people.find((x) => x.person.id === p) ?? people[0];

  if (!selected) {
    return (
      <Shell nav>
        <h1 className={shell.hero}>{t.family.empty}</h1>
        <p style={{ margin: 0 }}>{t.family.missing}</p>
      </Shell>
    );
  }

  const { person } = selected;
  const isSelf = person.relation.toLowerCase() === "self";
  const status = selected.call
    ? t.family.callUs
    : selected.fresh.length > 0
      ? isSelf
        ? t.family.newPage
        : t.family.newPageFor.replace("{name}", firstName(person.name))
      : selected.preparing.length > 0
        ? t.family.preparing
        : person.reports.length === 0
          ? t.family.empty
          : t.family.nothingNew;

  const details = [
    ...selected.fresh.map((r) => `${r.test.name}: signed ${signedWhen(r.signedAt)}.`),
    ...selected.preparing.map((r) => `${r.test.name}: still with the doctor.`),
  ];

  return (
    <Shell
      nav
      tint={selected.tint}
      tabs={
        <>
          <p className={shell.lede} style={{ margin: "0 4px 16px" }}>
            {people.length === 1
              ? t.family.ledeOne
              : t.family.lede.replace("{count}", numberWord(people.length))}
          </p>
          <FamilyTabs
            people={people}
            currentId={person.id}
            href={(id) => `/family?p=${id}`}
            t={t.family}
            keepTint
          />
        </>
      }
    >
      <div className={shell.split}>
        <div className={shell.col}>
          <span className={shell.eyebrow}>
            {isSelf ? t.family.you : person.relation} · {person.age}
          </span>
          <h1 className={shell.hero} style={{ marginTop: -16 }}>
            {person.name}
          </h1>
          <NotchRule />
        </div>
        <div className={shell.col}>
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-serif)",
              fontSize: "1.45em",
              lineHeight: 1.25,
              color: selected.call ? "var(--clay)" : undefined,
            }}
          >
            {selected.call ? <span aria-hidden="true">● </span> : null}
            {status}
          </p>
          {details.length > 0 ? <p style={{ margin: 0 }}>{details.join(" ")}</p> : null}
          <PrimaryLink href={`/file/${person.id}`} prefetch={false}>
            {isSelf ? t.family.openMine : t.family.open}
          </PrimaryLink>
          <div
            className={shell.stack}
            style={{ borderTop: "1.5px solid var(--ink)", paddingTop: 16 }}
          >
            <span>{t.family.missing}</span>
            <TextLink href="/settings/people" prefetch={false}>
              {t.nav.people}
            </TextLink>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function numberWord(n: number): string {
  return ["No", "One", "Two", "Three", "Four", "Five", "Six"][n] ?? String(n);
}
