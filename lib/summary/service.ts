import { checkAiSummary, type AiFacts } from "@/lib/ai/checker";
import { PROMPT_VERSION, summaryWriter, type SummaryWriter } from "@/lib/ai/provider";
import { db } from "@/lib/db/client";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Locale } from "@/lib/i18n";
import { buildSummary, type Summary } from "./builder";
import { DEFAULT_TEMPLATES } from "./templates";

/**
 * What a patient reads about one report:
 * 1. Critical: nothing but "Please call us". No AI, no values.
 * 2. Every result line: rules plus locked templates, in the patient's language
 *    where an approved translation exists, otherwise English.
 * 3. "In short": for a test without locked wording, an AI paragraph, shown only
 *    if the checker passes it. Otherwise the template sentence. Every attempt
 *    is stored for the pathologist's weekly review.
 */

type ReportWithResults = Prisma.ReportGetPayload<{
  include: { test: true; results: { include: { analyte: true } } };
}>;

export interface PatientSummary {
  summary: Summary;
  ai: { text: string; model: string } | null;
}

/** Do not ask the AI again for a report whose last attempt failed within a day. */
const RETRY_AFTER_MS = 24 * 60 * 60_000;

export async function approvedTemplates(
  language: "EN" | "TE" | "HI",
): Promise<Map<string, string>> {
  const rows = await db.summaryTemplate.findMany({
    where: { language, status: "APPROVED" },
    orderBy: { version: "asc" },
  });
  // Later versions overwrite earlier ones, so each key holds its newest approved wording.
  const map = new Map(rows.map((r) => [r.key, r.body]));
  if (language === "EN") {
    for (const [key, body] of Object.entries(DEFAULT_TEMPLATES.EN)) {
      if (!map.has(key)) map.set(key, body);
    }
  }
  return map;
}

/**
 * Rules and templates only, never the AI: for lists, cards and printouts that
 * show each result's words but must not trigger a model call.
 */
export async function ruleSummary(report: ReportWithResults, locale: Locale): Promise<Summary> {
  const english = await approvedTemplates("EN");
  const local = locale === "en" ? english : await approvedTemplates(locale === "te" ? "TE" : "HI");
  return buildSummary(
    {
      testCode: report.test.code,
      testName: report.test.name,
      hasCritical: report.hasCritical,
      results: report.results.map((r) => ({
        name: r.analyte.name,
        helper: r.analyte.helper,
        unit: r.analyte.unit,
        value: r.value,
        valueText: r.valueText,
        refLow: r.refLow,
        refHigh: r.refHigh,
        refText: r.refText,
        flag: r.flag,
      })),
    },
    local,
    english,
  );
}

export async function summaryForReport(
  report: ReportWithResults,
  locale: Locale,
  deps: { writer?: SummaryWriter | null } = {},
): Promise<PatientSummary> {
  const english = await approvedTemplates("EN");
  const local = locale === "en" ? english : await approvedTemplates(locale === "te" ? "TE" : "HI");

  const summary = buildSummary(
    {
      testCode: report.test.code,
      testName: report.test.name,
      hasCritical: report.hasCritical,
      results: report.results.map((r) => ({
        name: r.analyte.name,
        helper: r.analyte.helper,
        unit: r.analyte.unit,
        value: r.value,
        valueText: r.valueText,
        refLow: r.refLow,
        refHigh: r.refHigh,
        refText: r.refText,
        flag: r.flag,
      })),
    },
    local,
    english,
  );

  // The AI path: never for critical reports, never for tests with locked wording.
  if (summary.kind === "CRITICAL" || report.test.locked) return { summary, ai: null };

  // The AI's English facts come from the English wording, whatever the reader's language.
  const englishSummary =
    locale === "en"
      ? summary
      : buildSummary(
          {
            testCode: report.test.code,
            testName: report.test.name,
            hasCritical: false,
            results: summary.items,
          },
          english,
        );
  if (englishSummary.kind === "CRITICAL") return { summary, ai: null };

  const facts: AiFacts = {
    testName: report.test.name,
    results: englishSummary.items.map((i) => ({
      name: i.name,
      unit: i.unit,
      valueText: i.valueText,
      refText: i.refText,
      flag: i.flag,
      words: i.word.replace(/\.$/, "").toLowerCase(),
    })),
  };

  const writer = deps.writer === undefined ? summaryWriter() : deps.writer;
  return { summary, ai: await aiParagraph(report.id, facts, writer) };
}

async function aiParagraph(
  reportId: string,
  facts: AiFacts,
  writer: SummaryWriter | null,
): Promise<{ text: string; model: string } | null> {
  const last = await db.aiSummary.findFirst({
    where: { reportId, language: "EN" },
    orderBy: { createdAt: "desc" },
  });
  if (last?.status === "SHOWN" && last.body) return { text: last.body, model: last.model };
  if (last && Date.now() - last.createdAt.getTime() < RETRY_AFTER_MS) return null;
  if (!writer) return null;

  const started = Date.now();
  try {
    const text = (await writer.write(facts)).trim();
    const check = checkAiSummary(text, facts);
    await db.aiSummary.create({
      data: {
        reportId,
        language: "EN",
        body: text,
        model: writer.model,
        promptVersion: PROMPT_VERSION,
        status: check.ok ? "SHOWN" : "REJECTED",
        checkerNotes: check.ok ? null : check.problems.join(" "),
        latencyMs: Date.now() - started,
      },
    });
    return check.ok ? { text, model: writer.model } : null;
  } catch (error) {
    await db.aiSummary.create({
      data: {
        reportId,
        language: "EN",
        body: null,
        model: writer.model,
        promptVersion: PROMPT_VERSION,
        status: "FAILED",
        checkerNotes: error instanceof Error ? error.message : "The AI call failed.",
        latencyMs: Date.now() - started,
      },
    });
    return null;
  }
}

/** "Haemoglobin was 10.9 on 12 Aug. This time it is 10.2." From a template; values only. */
export async function trendSentence(
  locale: Locale,
  values: { analyte: string; before: string; date: string; now: string },
): Promise<string> {
  const english = await approvedTemplates("EN");
  const local = locale === "en" ? english : await approvedTemplates(locale === "te" ? "TE" : "HI");
  const body = local.get("trend.change") ?? english.get("trend.change") ?? "";
  return body.replace(/\{(\w+)\}/g, (_, k: string) => values[k as keyof typeof values] ?? "");
}
