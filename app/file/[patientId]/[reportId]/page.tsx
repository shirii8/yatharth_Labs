import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { ListenButton } from "@/components/patient/ListenButton";
import { RangeRuler } from "@/components/patient/RangeRuler";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { OutlineLink, TextLink } from "@/components/ui/Button";
import uiStyles from "@/components/ui/ui.module.css";
import { Tabs } from "@/components/ui/Tabs";
import { hasConsent } from "@/lib/auth/access";
import { currentSession, ipHash, sessionToken } from "@/lib/auth/cookies";
import { db } from "@/lib/db/client";
import { localeFromCookie, messages, type Locale, type Messages } from "@/lib/i18n";
import { openReport, previousReport } from "@/lib/patient/open-report";
import { dateTime, firstName } from "@/lib/patient-format";
import type { SummaryItem } from "@/lib/summary/builder";
import { summaryForReport, trendSentence } from "@/lib/summary/service";
import { CriticalReport } from "./critical";
import styles from "./report.module.css";

export const metadata: Metadata = { title: "Your report" };

const TINTS = ["var(--sky)", "var(--sage)", "var(--sand)", "var(--lilac)", "var(--rose)"];

type Params = { patientId: string; reportId: string };
type Search = { r?: string; view?: string };

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const session = await currentSession();
  if (!session || session.kind === "STAFF" || !session.householdId) {
    redirect((await sessionToken()) ? "/notice/timeout" : "/");
  }
  const household = await db.household.findUniqueOrThrow({ where: { id: session.householdId } });
  if (!hasConsent(household)) redirect("/consent");

  const { patientId, reportId } = await params;
  const search = await searchParams;
  // Record the opening once per visit, not on every Back / Next between results.
  const report = await openReport(session, reportId, {
    record: !search.r && !search.view,
    ipHash: await ipHash(),
  });
  if (!report || report.patientId !== patientId) notFound();

  const locale = localeFromCookie((await cookies()).get("lang")?.value);
  const t = messages(locale);
  const name = firstName(report.patient.name);
  const back =
    session.kind === "LINK"
      ? { href: "/", label: t.report.signInForMore }
      : { href: `/file/${patientId}`, label: t.report.backTo.replace("{name}", name) };
  const base = `/file/${patientId}/${reportId}`;

  if (report.hasCritical) {
    return <CriticalReport report={report} t={t} back={back} base={base} />;
  }

  const { summary, ai } = await summaryForReport(report, locale);
  if (summary.kind === "CRITICAL") {
    return <CriticalReport report={report} t={t} back={back} base={base} />;
  }

  const compact =
    search.view === "compact" || (!search.view && household.readingMode === "COMPACT");
  const linkExpiry =
    session.kind === "LINK"
      ? (await db.reportLink.findFirst({ where: { reportId }, orderBy: { createdAt: "desc" } }))
          ?.expiresAt
      : undefined;

  const intro = ai?.text ?? summary.intro;
  const greeting = `${name} ${t.common.honorific},`;
  const title = t.report.titleFor.replace("{test}", report.test.name);
  const switchView = (
    <OutlineLink
      href={`${base}?view=${compact ? "simple" : "compact"}`}
      prefetch={false}
      style={{ minHeight: 48, borderRadius: 999, padding: "4px 14px", fontSize: 15 }}
    >
      {compact ? t.report.simple : t.report.compact}
    </OutlineLink>
  );

  const nextCard = (
    <NextSteps
      t={t}
      steps={summary.nextSteps}
      footer={summary.footer}
      base={base}
      expiry={linkExpiry}
    />
  );

  return (
    <Shell sheet={false} back={back} actions={switchView} mode={compact ? "compact" : "simple"}>
      <div className={shell.split}>
        <div className={shell.col}>
          <p className={styles.greeting}>{greeting}</p>
          <h1 className={styles.title}>{title}</h1>
          <svg
            className={styles.thread}
            viewBox="0 0 240 10"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M2 5H238"
              pathLength={1}
              fill="none"
              stroke="var(--green)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
          <h2 className="visually-hidden">{t.report.inShort}</h2>
          <p className={styles.inShort}>{intro}</p>
          {ai ? <p className={styles.aiNote}>{t.report.aiNote}</p> : null}
          <ListenButton
            locale={locale}
            label={t.report.listen}
            stopLabel={t.report.stop}
            text={[
              greeting,
              title,
              intro,
              ...summary.items.map(
                (i) => `${i.name}: ${i.valueText} ${i.unit}. ${i.word} ${i.sentence}`,
              ),
            ].join(" ")}
          />
          {compact ? (
            <CompactResults items={summary.items} t={t} report={report} locale={locale} />
          ) : (
            <SimpleResult items={summary.items} t={t} base={base} index={Number(search.r ?? 1)} />
          )}
        </div>
        <div className={`${shell.col} ${shell.sticky}`}>{nextCard}</div>
      </div>
    </Shell>
  );
}

function usualLabel(item: SummaryItem, t: Messages) {
  const text = item.refText.trim();
  if (text.startsWith("<")) return t.report.usualBelow.replace("{high}", text.slice(1).trim());
  if (text.startsWith(">")) return t.report.usualAbove.replace("{low}", text.slice(1).trim());
  return t.report.usual.replace("{range}", text.replace("-", "–"));
}

function ariaFor(item: SummaryItem, t: Messages) {
  return `${item.name} ${item.valueText} ${item.unit}, ${usualLabel(item, t)}, ${item.word}`;
}

/** Simple: one result at a time, very large type, Back and Next. */
function SimpleResult({
  items,
  t,
  base,
  index,
}: {
  items: SummaryItem[];
  t: Messages;
  base: string;
  index: number;
}) {
  const n = Math.min(Math.max(Number.isFinite(index) ? index : 1, 1), items.length);
  const item = items[n - 1]!;
  const count = items.length;

  return (
    <section aria-labelledby="result-name">
      <Tabs
        label={t.report.resultsLabel}
        items={items.map((it, i) => ({
          key: it.name,
          href: `${base}?r=${i + 1}`,
          current: i + 1 === n,
          tint: TINTS[i % TINTS.length],
          ariaLabel: t.report.resultOf
            .replace("{n}", String(i + 1))
            .replace("{count}", String(count)),
          label: (
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 500 }}>
              {i + 1 < n ? "✓ " : ""}
              {i + 1}
            </span>
          ),
        }))}
      />
      <div className={`${shell.card} ${styles.resultCard}`}>
        <span className={shell.eyebrow}>
          {t.report.resultOf.replace("{n}", String(n)).replace("{count}", String(count))}
        </span>
        <h3 id="result-name" className={styles.name}>
          {item.name}
        </h3>
        <span style={{ marginTop: -6 }}>{item.helper}</span>
        <div className={styles.value}>
          {item.valueText}
          <span className={styles.unit}>{item.unit}</span>
        </div>
        <RangeRuler
          key={item.name}
          value={item.value}
          low={item.refLow}
          high={item.refHigh}
          usualLabel={usualLabel(item, t)}
          youLabel={t.report.you}
          ariaLabel={ariaFor(item, t)}
        />
        <p className={styles.words}>
          <strong className={item.tone === "ATTENTION" ? styles.attention : undefined}>
            {item.tone === "USUAL" ? "✓ " : ""}
            {item.word}
          </strong>{" "}
          {item.sentence}
        </p>
        <p className={styles.rule}>{item.rule}</p>
        <div className={styles.nav}>
          {n > 1 ? (
            <OutlineLink href={`${base}?r=${n - 1}`} prefetch={false}>
              {t.report.prev}
            </OutlineLink>
          ) : null}
          {n < count ? (
            <Link2 href={`${base}?r=${n + 1}`}>{t.report.next}</Link2>
          ) : (
            <Link2 href="#next">{t.report.last}</Link2>
          )}
        </div>
      </div>
    </section>
  );
}

function Link2({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      className={uiStyles.outline}
      style={{ background: "var(--green)", color: "var(--on-green)", borderColor: "var(--green)" }}
    >
      {children}
    </a>
  );
}

/** Compact: every result on one page, tighter, with how it changed since last time. */
async function CompactResults({
  items,
  t,
  report,
  locale,
}: {
  items: SummaryItem[];
  t: Messages;
  report: { id: string; patientId: string; testId: string; createdAt: Date };
  locale: Locale;
}) {
  const previous = await previousReport(report);
  const flagged = items.find((i) => i.tone === "ATTENTION") ?? items[0];
  const current = await db.result.findMany({
    where: { reportId: report.id },
    include: { analyte: true },
  });
  const target = current.find((r) => r.analyte.name === flagged?.name);
  const before = previous?.results.find((r) => r.analyteId === target?.analyteId);
  const date = previous?.signedAt?.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
  const sentence =
    flagged && target && before && date
      ? await trendSentence(locale, {
          analyte: flagged.name,
          before: before.valueText,
          date,
          now: flagged.valueText,
        })
      : null;

  return (
    <>
      <section className={shell.card} aria-labelledby="all-results">
        <h3 id="all-results" className={shell.eyebrow} style={{ margin: 0 }}>
          {t.report.allResults}
        </h3>
        <div>
          {items.map((item) => (
            <div key={item.name} className={styles.compactRow}>
              <strong>{item.name}</strong>
              <span className={styles.compactValue}>
                {item.valueText} <small style={{ fontSize: 14 }}>{item.unit}</small>
              </span>
              <span
                className={`${styles.mark} ${item.tone === "ATTENTION" ? styles.attention : ""}`}
              >
                {item.tone === "USUAL" ? "✓ " : item.flag === "LOW" ? "▼ " : "▲ "}
                {item.word}
              </span>
              <span style={{ fontSize: 14, textAlign: "right" }}>{usualLabel(item, t)}</span>
              <div style={{ gridColumn: "1 / -1" }}>
                <RangeRuler
                  value={item.value}
                  low={item.refLow}
                  high={item.refHigh}
                  usualLabel=""
                  youLabel={t.report.you}
                  ariaLabel={ariaFor(item, t)}
                  animate={false}
                />
              </div>
            </div>
          ))}
        </div>
        <p className={styles.small}>{(items.find((i) => i.tone === "USUAL") ?? items[0])?.rule}</p>
      </section>
      {sentence && before && flagged ? (
        <section className={shell.card} aria-labelledby="trend">
          <h3 id="trend" className={shell.eyebrow} style={{ margin: 0 }}>
            {t.report.trendHead}
          </h3>
          <Trend
            before={before.value}
            now={flagged.value}
            beforeLabel={date!}
            sentence={sentence}
          />
          <p style={{ margin: 0 }}>{sentence}</p>
        </section>
      ) : null}
    </>
  );
}

/** Two points and a line: a small inline SVG, no chart library. */
function Trend({
  before,
  now,
  beforeLabel,
  sentence,
}: {
  before: number;
  now: number;
  beforeLabel: string;
  sentence: string;
}) {
  const low = Math.min(before, now);
  const high = Math.max(before, now);
  const pad = (high - low || Math.abs(high) || 1) * 0.6;
  const y = (v: number) => 70 - ((v - (low - pad)) / (high - low + 2 * pad)) * 60;
  return (
    <svg role="img" aria-label={sentence} viewBox="0 0 300 96" width="100%">
      <path d={`M40 ${y(before)} L260 ${y(now)}`} stroke="var(--ink)" strokeWidth="2" fill="none" />
      <circle cx="40" cy={y(before)} r="6" fill="var(--page)" stroke="var(--ink)" strokeWidth="2" />
      <circle cx="260" cy={y(now)} r="7" fill="var(--green)" />
      <text x="40" y="92" textAnchor="middle" fontSize="13" fill="var(--ink)">
        {beforeLabel}
      </text>
      <text x="260" y="92" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--ink)">
        Now
      </text>
    </svg>
  );
}

function NextSteps({
  t,
  steps,
  footer,
  base,
  expiry,
}: {
  t: Messages;
  steps: string[];
  footer: string;
  base: string;
  expiry?: Date;
}) {
  return (
    <section
      id="next"
      className={shell.card}
      aria-labelledby="next-head"
      style={{ background: "var(--field)" } as CSSProperties}
    >
      <h2 id="next-head" className={shell.eyebrow} style={{ margin: 0, fontWeight: 700 }}>
        {t.report.nextHead}
      </h2>
      <ol className={styles.steps}>
        {steps.map((s, i) => (
          <li key={s}>
            <span aria-hidden="true">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className={styles.pair}>
        <OutlineLink href={`${base}/print`} prefetch={false}>
          {t.report.print}
        </OutlineLink>
        <a className={uiStyles.outline} href={`${base}/pdf`}>
          {t.report.full}
        </a>
      </div>
      <TextLink href={`${base}/flag`}>
        <span aria-hidden="true" style={{ marginRight: 8 }}>
          ⚑
        </span>
        {t.report.flag}
      </TextLink>
      <p className={styles.small} style={{ borderTop: "1.5px solid var(--ink)", paddingTop: 12 }}>
        {t.report.ledger.replace("{when}", dateTime(new Date()))}{" "}
        <a href="/me/data" style={{ fontWeight: 700 }}>
          {t.report.ledgerLink}
        </a>
      </p>
      {expiry ? (
        <p className={styles.small}>{t.report.expiry.replace("{when}", `${dateTime(expiry)}`)}</p>
      ) : null}
      <p className={styles.small} style={{ color: "var(--ink-soft)" }}>
        {footer}
      </p>
    </section>
  );
}
