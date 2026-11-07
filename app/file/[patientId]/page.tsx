import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyFolder, Kettle } from "@/components/patient/Drawings";
import { FamilyTabs } from "@/components/patient/FamilyTabs";
import { Mark, Pill, ResultRow, toneOf, type Tone } from "@/components/patient/ResultBits";
import resultStyles from "@/components/patient/result.module.css";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { OutlineLink, PrimaryLink } from "@/components/ui/Button";
import { NotchRule } from "@/components/ui/NotchRule";
import { requireConsentedPatient } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import type { Prisma } from "@/lib/generated/prisma/client";
import { localeFromCookie, messages, type Locale, type Messages } from "@/lib/i18n";
import { familyOverview } from "@/lib/patient/family";
import { firstName, formatUnit } from "@/lib/patient-format";
import type { Summary } from "@/lib/summary/builder";
import { ruleSummary, trendSentence } from "@/lib/summary/service";
import styles from "./list.module.css";

export const metadata: Metadata = { title: "Your file" };

const IST = "Asia/Kolkata";
const day = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: IST });
const short = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST });

/**
 * One person's file. Left: where things stand (a title, a proportion bar and
 * three counts). Right: every page as a card with its results in rule words,
 * then each test's values over time. Phones stack the same parts in order.
 */
export default async function ReportsListPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { session } = await requireConsentedPatient();
  const { patientId } = await params;
  const locale = localeFromCookie((await cookies()).get("lang")?.value);
  const t = messages(locale);
  const people = await familyOverview(session);
  // Only people on this session's number exist here; anyone else is "not found".
  const me = people.find((x) => x.person.id === patientId);
  if (!me) notFound();
  const { person } = me;

  // Signed pages with their results; values for critical pages are never loaded here.
  const signedIds = person.reports.filter((r) => r.status === "SIGNED").map((r) => r.id);
  const reports = await db.report.findMany({
    where: { id: { in: signedIds }, patient: { householdId: session.householdId! } },
    orderBy: { signedAt: "desc" },
    include: {
      test: true,
      results: { include: { analyte: true }, orderBy: { analyte: { sortOrder: "asc" } } },
    },
  });
  const firstOpened = new Map(
    (
      await db.accessLog.groupBy({
        by: ["reportId"],
        where: { reportId: { in: signedIds }, action: "REPORT_OPENED" },
        _min: { at: true },
      })
    ).map((g) => [g.reportId, g._min.at]),
  );
  const summaries = new Map<string, Summary>();
  for (const r of reports) {
    if (!r.hasCritical) summaries.set(r.id, await ruleSummary(r, locale));
  }

  const calls = reports.filter((r) => r.hasCritical);
  const fresh = reports.filter((r) => !r.hasCritical && !firstOpened.get(r.id));
  const waiting = me.preparing;

  let usual = 0;
  let outside = 0;
  for (const s of summaries.values()) {
    if (s.kind !== "RESULTS") continue;
    for (const i of s.items) {
      if (i.tone === "USUAL") usual++;
      else outside++;
    }
  }

  const title =
    calls.length > 0
      ? t.file.callTitle
      : reports.length === 0 && waiting.length === 0
        ? t.file.empty
        : fresh.length === 0
          ? t.file.noneNew
          : (fresh.length === 1 ? t.file.newCount : t.file.newCountMany).replace(
              "{count}",
              ["", "One", "Two", "Three", "Four"][fresh.length] ?? String(fresh.length),
            );
  const body =
    calls.length > 0
      ? t.file.callBodyTop
      : reports.length === 0 && waiting.length === 0
        ? t.file.emptyBody.replace("{name}", firstName(person.name))
        : fresh.length > 0
          ? t.file.newBody
          : t.file.caughtUpBody;

  const testName = (code: string, fallback: string) => t.tests[code] ?? fallback;

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
      <div className={styles.layout}>
        <aside className={styles.side}>
          <span className={shell.eyebrow}>{t.file.eyebrow.replace("{name}", person.name)}</span>
          <h1 className={shell.hero} style={{ marginTop: -12 }}>
            {title}
          </h1>
          <p style={{ margin: 0 }}>{body}</p>

          {usual + outside > 0 ? (
            <div
              className={styles.bar}
              role="img"
              aria-label={`${usual} ${t.file.tileUsual}, ${outside} ${t.file.tileOutside}`}
            >
              <span className={styles.barUsual} style={{ flexGrow: usual }} />
              {outside > 0 ? (
                <span className={styles.barOutside} style={{ flexGrow: outside }} />
              ) : null}
            </div>
          ) : null}

          {reports.length + waiting.length > 0 ? (
            <ul className={styles.tiles} data-advanced="">
              <Tile tone="usual" n={usual} label={t.file.tileUsual} />
              <Tile tone="low" n={outside} label={t.file.tileOutside} />
              <Tile tone="waiting" n={waiting.length} label={t.file.tileWaiting} />
            </ul>
          ) : (
            <div className={shell.aside} style={{ marginTop: 0 }}>
              <EmptyFolder />
            </div>
          )}

          <Link href="/family" className={styles.back} prefetch={false}>
            <span aria-hidden="true">←</span> {t.file.switchPerson}
          </Link>
        </aside>

        <div className={styles.main}>
          <div className={styles.cards}>
            {calls.map((r) => (
              <article key={r.id} className={styles.card} data-tone="call">
                <header className={styles.cardHead}>
                  <span className={styles.cardTab}>{testName(r.test.code, r.test.name)}</span>
                  <span className={styles.cardMeta}>{r.signedAt ? short(r.signedAt) : ""}</span>
                </header>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitleRow}>
                    <h2 className={styles.cardTitle}>{r.signedAt ? day(r.signedAt) : ""}</h2>
                    <Pill tone="call">{t.file.callTag}</Pill>
                  </div>
                  <p style={{ margin: 0 }}>{t.file.callBody}</p>
                  <PrimaryLink href={`/file/${person.id}/${r.id}`} prefetch={false}>
                    {t.file.callOpen}
                  </PrimaryLink>
                </div>
              </article>
            ))}

            {waiting.map((r) => (
              <article key={r.id} className={styles.card} data-tone="waiting">
                <header className={styles.cardHead}>
                  <span className={styles.cardTab}>{testName(r.test.code, r.test.name)}</span>
                </header>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitleRow}>
                    <h2 className={styles.cardTitle}>{t.file.preparingTitle}</h2>
                    <Kettle size={56} />
                  </div>
                  <p style={{ margin: 0 }}>{t.file.preparingBody}</p>
                </div>
              </article>
            ))}

            {reports
              .filter((r) => !r.hasCritical)
              .map((r) => {
                const s = summaries.get(r.id);
                if (!s || s.kind !== "RESULTS") return null;
                const flagged = s.items.filter((i) => i.tone === "ATTENTION");
                const isNew = !firstOpened.get(r.id);
                const opened = firstOpened.get(r.id);
                return (
                  <article
                    key={r.id}
                    className={styles.card}
                    data-tone={flagged.length ? "attention" : "usual"}
                  >
                    <header className={styles.cardHead}>
                      <span className={styles.cardTab}>{testName(r.test.code, r.test.name)}</span>
                      <span className={styles.cardMeta} data-new={isNew ? "" : undefined}>
                        {isNew
                          ? t.file.newLabel
                          : opened
                            ? t.file.readOn.replace("{date}", short(opened))
                            : ""}
                      </span>
                    </header>
                    <div className={styles.cardBody}>
                      <div className={styles.cardTitleRow}>
                        <h2 className={styles.cardTitle}>{r.signedAt ? day(r.signedAt) : ""}</h2>
                        {flagged.length === 0 ? (
                          <Pill tone="usual">{t.file.allUsual}</Pill>
                        ) : (
                          <FlagPills items={flagged} />
                        )}
                      </div>
                      <ul className={resultStyles.rows}>
                        {s.items.map((item, i) => (
                          <ResultRow
                            key={item.name}
                            index={i}
                            tone={toneOf(item.flag)}
                            name={item.name}
                            value={item.valueText}
                          />
                        ))}
                      </ul>
                      <p style={{ margin: 0, fontSize: "0.9em" }}>
                        {flagged.length ? s.nextSteps[0] : s.intro}
                      </p>
                      {isNew ? (
                        <PrimaryLink href={`/file/${person.id}/${r.id}`} prefetch={false}>
                          {t.file.open}
                        </PrimaryLink>
                      ) : (
                        <OutlineLink href={`/file/${person.id}/${r.id}`} prefetch={false}>
                          {t.file.readAgain}
                        </OutlineLink>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>

          <OverTime
            reports={reports.filter((r) => !r.hasCritical)}
            summaries={summaries}
            t={t}
            locale={locale}
          />
        </div>
      </div>
    </Shell>
  );
}

function Tile({ tone, n, label }: { tone: Tone; n: number; label: string }) {
  return (
    <li className={styles.tile} data-tone={tone}>
      <span className={styles.tileN}>{n}</span>
      <span className={styles.tileLabel}>
        <Mark tone={tone} size={12} /> {label}
      </span>
    </li>
  );
}

/** "▼ 1 a little low", one pill per kind of finding, words from the templates. */
function FlagPills({ items }: { items: { word: string; flag: "LOW" | "USUAL" | "HIGH" }[] }) {
  const groups = new Map<string, { n: number; flag: "LOW" | "USUAL" | "HIGH" }>();
  for (const i of items) {
    const g = groups.get(i.word) ?? { n: 0, flag: i.flag };
    g.n += 1;
    groups.set(i.word, g);
  }
  return (
    <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {[...groups].map(([word, g]) => (
        <Pill key={word} tone={toneOf(g.flag)}>
          {g.n} {word.replace(/\.$/, "").toLowerCase()}
        </Pill>
      ))}
    </span>
  );
}

type ListReport = Prisma.ReportGetPayload<{
  include: { test: true; results: { include: { analyte: true } } };
}>;

/**
 * Each test signed more than once: its values side by side, oldest to newest,
 * with one sentence from the trend template. Hidden in easy view.
 */
async function OverTime({
  reports,
  summaries,
  t,
  locale,
}: {
  reports: ListReport[];
  summaries: Map<string, Summary>;
  t: Messages;
  locale: Locale;
}) {
  const byTest = new Map<string, ListReport[]>();
  for (const r of reports) byTest.set(r.testId, [...(byTest.get(r.testId) ?? []), r]);
  const groups = [...byTest.values()].filter((g) => g.length > 1);
  if (groups.length === 0) return null;

  const sections = [];
  for (const group of groups) {
    const ordered = [...group]
      .sort((a, b) => (a.signedAt?.getTime() ?? 0) - (b.signedAt?.getTime() ?? 0))
      .slice(-3);
    const latest = ordered[ordered.length - 1]!;
    const previous = ordered[ordered.length - 2]!;
    const latestSummary = summaries.get(latest.id);
    const changed =
      latestSummary?.kind === "RESULTS"
        ? (latestSummary.items.find((i) => i.tone === "ATTENTION") ?? latestSummary.items[0])
        : undefined;
    const before = previous.results.find((r) => r.analyte.name === changed?.name);
    const sentence =
      changed && before && previous.signedAt
        ? await trendSentence(locale, {
            analyte: changed.name,
            before: before.valueText,
            date: short(previous.signedAt),
            now: changed.valueText,
          })
        : null;
    sections.push(
      <section key={latest.testId} className={styles.overTime} data-advanced="">
        <NotchRule />
        <div className={styles.overHead}>
          <h2 className={styles.overTitle}>
            {t.file.overTime.replace(
              "{test}",
              (t.tests[latest.test.code] ?? latest.test.name).toLowerCase(),
            )}
          </h2>
          {sentence ? <p className={styles.overNote}>{sentence}</p> : null}
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t.file.colResult}</th>
                <th scope="col">{t.file.colRange}</th>
                {ordered.map((r) => (
                  <th key={r.id} scope="col">
                    {r.signedAt ? short(r.signedAt) : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {latest.results.map((res) => (
                <tr key={res.id}>
                  <th scope="row">{res.analyte.name}</th>
                  <td>
                    {res.refText.replace("-", "–")} {formatUnit(res.analyte.unit)}
                  </td>
                  {ordered.map((r) => {
                    const v = r.results.find((x) => x.analyteId === res.analyteId);
                    const tone = v ? toneOf(v.flag) : "usual";
                    return (
                      <td key={r.id}>
                        {v ? (
                          <span className={styles.cell} data-tone={tone}>
                            <Mark tone={tone} size={12} /> {v.valueText}
                          </span>
                        ) : (
                          "–"
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>,
    );
  }
  return <>{sections}</>;
}
