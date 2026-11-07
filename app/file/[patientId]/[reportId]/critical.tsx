import { Phone } from "@/components/patient/Drawings";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import uiStyles from "@/components/ui/ui.module.css";
import { db } from "@/lib/db/client";
import type { Messages } from "@/lib/i18n";
import { clock, firstName } from "@/lib/patient-format";
import { approvedTemplates } from "@/lib/summary/service";
import styles from "./critical.module.css";

/**
 * Hero c, "Please call us": the stillest page in the product. No number, no
 * summary, no flag text, no red, and no AI. A callback task already exists,
 * created in the same transaction as the report's link. The safety note is one
 * fixed template, the same for every page like this.
 */
export async function CriticalReport({
  report,
  t,
  back,
  base,
}: {
  report: { id: string; patient: { name: string; relation: string } };
  t: Messages;
  back: { href: string; label: string };
  base: string;
}) {
  const task = await db.callbackTask.findFirst({
    where: { reportId: report.id, type: "CRITICAL" },
    orderBy: { createdAt: "desc" },
  });
  const templates = await approvedTemplates("EN");
  const rows = await db.summaryTemplate.findMany({
    where: { key: { in: ["critical.safety.head", "critical.safety.items"] }, status: "APPROVED" },
  });
  const pendingApproval = rows.length === 0 || rows.some((r) => r.needsDoctorApproval);
  const safetyHead = templates.get("critical.safety.head") ?? "";
  const safetyItems = (templates.get("critical.safety.items") ?? "").split("|").filter(Boolean);

  const self = report.patient.relation.toLowerCase() === "self";
  const head = self
    ? t.critical.headSelf
    : t.critical.head.replace("{name}", `${firstName(report.patient.name)} ${t.common.honorific}`);
  const phone = process.env.NEXT_PUBLIC_LAB_PHONE || "+910000000000";

  return (
    <Shell tone="call" back={back}>
      <div className={`${styles.calm} ${shell.split}`}>
        <div className={shell.col}>
          <Phone size={96} />
          <h1 className={styles.head}>{head}</h1>
          <p style={{ margin: 0 }}>{t.critical.body}</p>
          <a className={`${uiStyles.primary} ${styles.breathe}`} href={`tel:${phone}`}>
            <span>{t.critical.cta}</span>
            <span aria-hidden="true" className={uiStyles.chip}>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              >
                <path d="M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
              </svg>
            </span>
          </a>
          <section className={shell.stack} aria-labelledby="happens-now">
            <h2 id="happens-now" className={shell.eyebrow} style={{ margin: 0, fontWeight: 700 }}>
              {t.critical.nextHead}
            </h2>
            <ol className={styles.steps}>
              {t.critical.steps.map((step, i) => (
                <li key={step}>
                  <span
                    className={styles.mark}
                    data-done={i === 0 ? "true" : undefined}
                    aria-hidden="true"
                  >
                    {i === 0 ? "✓" : i + 1}
                  </span>
                  <span>
                    <strong style={{ display: "block" }}>{step}</strong>
                    <span style={{ fontSize: "0.85em", color: "var(--ink-soft)" }}>
                      {i === 0 && task
                        ? t.critical.stepSubs[0]!.replace("{time}", clock(task.createdAt))
                        : i === 0
                          ? ""
                          : t.critical.stepSubs[i]}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className={shell.col}>
          <section className={styles.safety} aria-labelledby="safety">
            <h2 id="safety" style={{ margin: 0, fontSize: "1em" }}>
              {safetyHead}
            </h2>
            <ul style={{ margin: 0, paddingLeft: 24 }}>
              {safetyItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p style={{ margin: 0, fontSize: "0.8em", color: "var(--ink-soft)" }}>
              {pendingApproval ? t.critical.pending : t.critical.approved}
            </p>
          </section>
          <a className={uiStyles.outline} href={`${base}/pdf`}>
            {t.critical.full}
          </a>
        </div>
      </div>
    </Shell>
  );
}
