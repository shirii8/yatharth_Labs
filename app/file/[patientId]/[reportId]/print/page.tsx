import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { reportForSession } from "@/lib/auth/access";
import { currentSession } from "@/lib/auth/cookies";
import { localeFromCookie, messages } from "@/lib/i18n";
import { dateTime } from "@/lib/patient-format";
import { summaryForReport } from "@/lib/summary/service";
import { PrintButton } from "./print-button";
import styles from "./print.module.css";

export const metadata: Metadata = { title: "Printable copy" };

/**
 * One A4 page in large type, for the fridge or the doctor's visit. Same rules
 * and words as the screen. A critical report prints only "Please call us".
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
  const lab = process.env.NEXT_PUBLIC_LAB_NAME || "The lab";
  const { summary, ai } = await summaryForReport(report, locale);

  return (
    <div className={styles.sheet}>
      <div className={styles.noPrint}>
        <PrintButton label={t.print.print} />
        <a href={`/file/${patientId}/${reportId}`} className={styles.back}>
          {t.print.back}
        </a>
      </div>
      <header className={styles.header}>
        <span className={styles.lab}>{lab}</span>
        <span>{t.print.simpleCopy}</span>
      </header>
      <h1 className={styles.name}>{report.patient.name}</h1>
      <p className={styles.meta}>
        {report.test.name} · {t.print.order} {report.orderId} · {t.print.signed}{" "}
        {report.signedAt ? dateTime(report.signedAt) : ""}
      </p>

      {summary.kind === "CRITICAL" ? (
        <p className={styles.callUs}>{t.print.callUs}</p>
      ) : (
        <>
          <p className={styles.intro}>{ai?.text ?? summary.intro}</p>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t.print.result}</th>
                <th scope="col">{t.print.value}</th>
                <th scope="col">{t.print.usual}</th>
                <th scope="col">{t.print.reading}</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.map((item) => (
                <tr key={item.name}>
                  <th scope="row">{item.name}</th>
                  <td>
                    <strong>{item.valueText}</strong> {item.unit}
                  </td>
                  <td>{item.refText}</td>
                  <td>
                    {item.tone === "USUAL" ? "✓ " : item.flag === "LOW" ? "▼ " : "▲ "}
                    {item.word}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ol className={styles.steps}>
            {summary.nextSteps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className={styles.small}>{summary.footer}</p>
        </>
      )}
      <p className={styles.small}>
        {t.print.footnote.replace("{lab}", lab)} {t.print.phone}{" "}
        {process.env.NEXT_PUBLIC_LAB_PHONE ?? ""}
      </p>
    </div>
  );
}
