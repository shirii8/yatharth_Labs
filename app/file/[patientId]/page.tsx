import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { EmptyFolder, FiledPage, Kettle } from "@/components/patient/Drawings";
import { FamilyTabs } from "@/components/patient/FamilyTabs";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { OutlineLink, PrimaryLink, TextLink } from "@/components/ui/Button";
import { NotchRule } from "@/components/ui/NotchRule";
import { requireConsentedPatient } from "@/lib/auth/guards";
import { localeFromCookie, messages } from "@/lib/i18n";
import { familyOverview } from "@/lib/patient/family";
import { firstName, signedWhen } from "@/lib/patient-format";
import styles from "./list.module.css";

export const metadata: Metadata = { title: "Your file" };

/** One person's file: new pages first, then pages being prepared, then filed-away pages. */
export default async function ReportsListPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { session } = await requireConsentedPatient();
  const { patientId } = await params;
  const t = messages(localeFromCookie((await cookies()).get("lang")?.value));
  const people = await familyOverview(session);
  // Only people on this session's number exist here; anyone else is "not found".
  const me = people.find((x) => x.person.id === patientId);
  if (!me) notFound();

  const { person } = me;
  const signed = person.reports.filter((r) => r.status === "SIGNED");
  const calls = signed.filter((r) => r.hasCritical);
  const fresh = me.fresh.filter((r) => !r.hasCritical);
  const filed = signed.filter((r) => !r.hasCritical && me.opened.has(r.id));
  const newCount = calls.length + fresh.length;

  const title =
    person.reports.length === 0
      ? t.file.empty
      : newCount === 0
        ? t.file.noneNew
        : (newCount === 1 ? t.file.newCount : t.file.newCountMany).replace(
            "{count}",
            ["", "One", "Two", "Three", "Four"][newCount] ?? String(newCount),
          );

  return (
    <Shell
      tabs={
        <FamilyTabs
          people={people}
          currentId={person.id}
          href={(id) => `/file/${id}`}
          t={t.family}
        />
      }
    >
      <span className={shell.eyebrow}>{t.file.eyebrow.replace("{name}", person.name)}</span>
      <h1 className={shell.hero} style={{ marginTop: -16 }}>
        {title}
      </h1>

      {person.reports.length === 0 ? (
        <div className={shell.aside} style={{ marginTop: 0 }}>
          <EmptyFolder />
          <span>{t.file.emptyBody.replace("{name}", firstName(person.name))}</span>
        </div>
      ) : null}

      <div className={styles.grid}>
        {calls.map((r) => (
          <section
            key={r.id}
            className={styles.page}
            style={{ "--tint": "var(--rose)" } as CSSProperties}
          >
            <span className={styles.tag} data-tone="call">
              {t.file.callTag}
            </span>
            <h2 className={styles.title}>{r.test.name}</h2>
            <p style={{ margin: 0 }}>{t.file.callBody}</p>
            <PrimaryLink href={`/file/${person.id}/${r.id}`} prefetch={false}>
              {t.file.callOpen}
            </PrimaryLink>
          </section>
        ))}

        {fresh.map((r) => (
          <section
            key={r.id}
            className={styles.page}
            style={{ "--tint": me.tint } as CSSProperties}
          >
            <span className={styles.tag}>
              {t.file.newTag.replace("{when}", signedWhen(r.signedAt))}
            </span>
            <h2 className={styles.title}>{r.test.name}</h2>
            <p style={{ margin: 0 }}>{t.file.signedAt.replace("{when}", signedWhen(r.signedAt))}</p>
            <PrimaryLink href={`/file/${person.id}/${r.id}`} prefetch={false}>
              {t.file.open}
            </PrimaryLink>
          </section>
        ))}
      </div>

      <div className={styles.grid}>
        {me.preparing.map((r) => (
          <div key={r.id} className={shell.stack}>
            <NotchRule />
            <div className={styles.row}>
              <Kettle />
              <div className={shell.stack} style={{ gap: 8 }}>
                <span className={shell.eyebrow}>
                  {t.file.preparingEyebrow.replace("{test}", r.test.name)}
                </span>
                <span className={styles.italic}>{t.file.preparingTitle}</span>
                <span style={{ fontSize: "0.9em" }}>{t.file.preparingBody}</span>
              </div>
            </div>
          </div>
        ))}

        {filed.map((r) => (
          <div key={r.id} className={shell.stack}>
            <NotchRule />
            <div className={styles.row}>
              <FiledPage />
              <div className={shell.stack} style={{ gap: 8 }}>
                <span className={shell.eyebrow}>
                  {t.file.filedEyebrow.replace("{test}", r.test.name).replace(
                    "{date}",
                    (r.signedAt ?? r.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      timeZone: "Asia/Kolkata",
                    }),
                  )}
                </span>
                <span style={{ fontSize: "0.9em" }}>{t.file.filedBody}</span>
                <OutlineLink href={`/file/${person.id}/${r.id}`} prefetch={false}>
                  {t.file.readAgain}
                </OutlineLink>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "auto" }}>
        <TextLink href="/family">{t.file.switchPerson}</TextLink>
      </div>
    </Shell>
  );
}
