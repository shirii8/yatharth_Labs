import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MiniRuler, Mark, Pill, toneOf } from "@/components/patient/ResultBits";
import { reportForSession } from "@/lib/auth/access";
import { currentSession } from "@/lib/auth/cookies";
import { localeFromCookie, messages } from "@/lib/i18n";
import { dateTime, formatUnit } from "@/lib/patient-format";
import { ruleSummary } from "@/lib/summary/service";
import { PrintButton } from "./print-button";
import styles from "./print.module.css";

export const metadata: Metadata = { title: "Printable copy" };

/**
 * The simple copy: one A4 page in large type, for the fridge or the doctor.
 * Laptops: a control panel beside the page. Phones: the page as cards with a
 * sticky Print / Save bar. Printing shows only the page. Wording comes from
 * the rules and templates only. A critical report prints only "please call us".
 */
export default async function PrintPage({
  params,
}: {
  params: Promise<{ patientId: string; reportId: string }>;
}) {
  const session = await currentSession();
  if (!session || session.kind === "STAFF") redirect("/");
  const { patientId, reportId } = await params;
  const report = await reportForSession(session, reportId);
  if (!report || report.patientId !== patientId) notFound();

  const locale = localeFromCookie((await cookies()).get("lang")?.value);
  const t = messages(locale);
  const p = t.print;
  const lab = process.env.NEXT_PUBLIC_LAB_NAME || "The lab";
  const phone = process.env.NEXT_PUBLIC_LAB_PHONE || "";
  const summary = await ruleSummary(report, locale);
  const base = `/file/${patientId}/${reportId}`;
  const testShort = t.tests[report.test.code] ?? report.test.name;

  const items = summary.kind === "RESULTS" ? summary.items : [];
  const usualCount = items.filter((i) => i.tone === "USUAL").length;
  const flagged = items.filter((i) => i.tone === "ATTENTION");
  // The first sentence counts results; the rest name what is outside the range.
  const sentences = summary.kind === "RESULTS" ? summary.intro.split(/(?<=\.) /) : [];

  return (
    <div className={styles.page}>
      <aside className={styles.panel}>
        <Link href={base} className={styles.back}>
          <span aria-hidden="true">←</span> {p.back}
        </Link>
        <h1 className={styles.panelTitle}>{p.pageTitle}</h1>
        <p className={styles.panelBody}>{p.pageBody}</p>
        <div className={styles.panelActions}>
          <PrintButton label={p.print} />
          <a className={styles.saveButton} href={`${base}/pdf?copy=simple`}>
            {p.save}
          </a>
        </div>
        <div className={styles.key}>
          <h2 className={styles.keyTitle}>{p.keyTitle}</h2>
          <KeyRow tone="usual" text={p.keyUsual} />
          <KeyRow tone="low" text={p.keyLow} />
          <KeyRow tone="high" text={p.keyHigh} />
          <KeyRow tone="call" text={p.keyCall} />
        </div>
      </aside>

      <article className={styles.sheet} aria-label={`${testShort}, ${p.simpleCopy}`}>
        <header className={styles.sheetHead}>
          <span className={styles.lab}>{lab}</span>
          <span className={styles.copyTag}>
            <span className={styles.copySwatch} aria-hidden="true" />
            {testShort} · {p.simpleCopyFor}
          </span>
        </header>

        <div className={styles.titleRow}>
          <div>
            <h2 className={styles.name}>{report.patient.name}</h2>
            <p className={styles.meta}>
              {report.test.name} · {p.order} {report.orderId} · {p.signed}{" "}
              {report.signedAt ? dateTime(report.signedAt) : ""}
            </p>
          </div>
          {summary.kind === "RESULTS" ? (
            <div className={styles.pills}>
              {usualCount > 0 ? (
                <Pill tone="usual">
                  {usualCount} {t.report.markUsual.toLowerCase()}
                </Pill>
              ) : null}
              {flagged.length > 0 ? (
                <Pill tone={toneOf(flagged[0]!.flag)}>
                  {flagged.length} {flagged[0]!.word.replace(/\.$/, "").toLowerCase()}
                </Pill>
              ) : null}
            </div>
          ) : null}
        </div>

        {summary.kind === "CRITICAL" ? (
          <p className={styles.callUs}>
            <Mark tone="call" size={20} /> {p.callUs}
          </p>
        ) : (
          <>
            <ul className={styles.chips} aria-hidden="true">
              {items.map((i) => (
                <li key={i.name} data-tone={toneOf(i.flag)}>
                  <Mark tone={toneOf(i.flag)} size={16} />
                  <span>{i.name}</span>
                </li>
              ))}
            </ul>

            <p className={styles.intro}>
              {sentences.map((s, idx) => (
                <span key={s} className={idx > 0 ? styles.highlight : undefined}>
                  {s}
                  {idx < sentences.length - 1 ? " " : ""}
                </span>
              ))}
            </p>

            <div className={styles.tableHead} aria-hidden="true">
              <span>{p.result}</span>
              <span>{p.value}</span>
              <span>{p.where}</span>
              <span>{p.reading}</span>
            </div>
            <ul className={styles.results}>
              {items.map((i) => {
                const tone = toneOf(i.flag);
                return (
                  <li key={i.name} className={styles.result} data-tone={tone}>
                    <div className={styles.resultName}>
                      <strong>{i.name}</strong>
                      <span>{i.helper}</span>
                    </div>
                    <div className={styles.resultValue}>
                      {i.valueText} <small>{formatUnit(i.unit)}</small>
                    </div>
                    <div className={styles.resultRuler}>
                      <MiniRuler
                        value={i.value}
                        low={i.refLow}
                        high={i.refHigh}
                        label={p.usualRange.replace("{range}", i.refText.replace("-", "–"))}
                      />
                    </div>
                    <div className={styles.resultWord}>
                      <Pill tone={tone}>{i.word.replace(/\.$/, "")}</Pill>
                    </div>
                  </li>
                );
              })}
            </ul>

            <section className={styles.next} aria-labelledby="print-next">
              <h3 id="print-next" className={styles.nextTitle}>
                {p.nextHead}
              </h3>
              <ol className={styles.nextList}>
                {summary.nextSteps.map((s, idx) => (
                  <li key={s}>
                    <span className={styles.nextN}>{idx + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        <footer className={styles.sheetFoot}>
          <p>
            {summary.kind === "RESULTS" ? `${summary.footer} ` : ""}
            {p.footnote.replace("{lab}", lab)}
          </p>
          <p className={styles.questions}>
            <strong>{p.questions}</strong>
            <br />
            {phone}
          </p>
        </footer>
      </article>

      <div className={styles.mobileBar}>
        <PrintButton label={p.print} />
        <a className={styles.saveButton} href={`${base}/pdf?copy=simple`}>
          {p.save}
        </a>
      </div>
    </div>
  );
}

function KeyRow({ tone, text }: { tone: "usual" | "low" | "high" | "call"; text: string }) {
  return (
    <p className={styles.keyRow} data-tone={tone}>
      <span className={styles.keySwatch} aria-hidden="true" />
      <Mark tone={tone} size={16} />
      <span>{text}</span>
    </p>
  );
}
