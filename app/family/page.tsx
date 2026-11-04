import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { PrimaryLink, TextLink } from "@/components/ui/Button";
import { NotchRule } from "@/components/ui/NotchRule";
import { Tabs } from "@/components/ui/Tabs";
import { familyForSession } from "@/lib/auth/access";
import { requireConsentedPatient } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { localeFromCookie, messages } from "@/lib/i18n";
import { firstName, signedWhen } from "@/lib/patient-format";

export const metadata: Metadata = { title: "Whose file?" };

const TINTS = ["var(--sky)", "var(--rose)", "var(--sand)", "var(--lilac)", "var(--sage)"];

/** "Whose file?": one index tab per family member on this number. */
export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { session } = await requireConsentedPatient();
  const t = messages(localeFromCookie((await cookies()).get("lang")?.value));
  const family = await familyForSession(session);
  const { p } = await searchParams;

  const opened = new Set(
    (
      await db.accessLog.findMany({
        where: { householdId: session.householdId, action: "REPORT_OPENED" },
        select: { reportId: true },
      })
    ).map((l) => l.reportId),
  );

  const people = family.map((person, i) => {
    const signed = person.reports.filter((r) => r.status === "SIGNED");
    return {
      person,
      tint: TINTS[i % TINTS.length]!,
      call: signed.some((r) => r.hasCritical),
      fresh: signed.filter((r) => !opened.has(r.id)),
      preparing: person.reports.filter((r) => r.status !== "SIGNED"),
    };
  });
  const selected = people.find((x) => x.person.id === p) ?? people[0];

  if (!selected) {
    return (
      <Shell>
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
      tint={selected.tint}
      tabs={
        <>
          <p className={shell.lede} style={{ margin: "0 4px 14px" }}>
            {people.length === 1
              ? t.family.ledeOne
              : t.family.lede.replace("{count}", numberWord(people.length))}
          </p>
          <Tabs
            label={t.family.label}
            keepTint
            items={people.map((x) => ({
              key: x.person.id,
              href: `/family?p=${x.person.id}`,
              current: x.person.id === person.id,
              tint: x.tint,
              ariaLabel: `${x.person.name}, ${
                x.call ? t.family.tabCall : x.fresh.length ? t.family.tabNew : t.family.tabNothing
              }`,
              label: (
                <>
                  {firstName(x.person.name)}
                  {x.call ? (
                    <span
                      aria-hidden="true"
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: "var(--clay)",
                        display: "inline-block",
                      }}
                    />
                  ) : null}
                </>
              ),
            }))}
          />
        </>
      }
    >
      <span style={{ fontSize: 15, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        {isSelf ? t.family.you : person.relation} · {person.age}
      </span>
      <h1 className={shell.hero} style={{ marginTop: -14 }}>
        {person.name}
      </h1>
      <NotchRule />
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
        style={{ marginTop: "auto", borderTop: "1.5px solid var(--ink)", paddingTop: 16 }}
      >
        <span>{t.family.missing}</span>
        <TextLink href="/me/data">{t.family.data}</TextLink>
      </div>
    </Shell>
  );
}

function numberWord(n: number): string {
  return ["No", "One", "Two", "Three", "Four", "Five", "Six"][n] ?? String(n);
}
