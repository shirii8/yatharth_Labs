import type { PrismaClient } from "@/lib/generated/prisma/client";
import { DEFAULT_TEMPLATES, NEEDS_DOCTOR_APPROVAL, type TemplateLanguage } from "./templates";

/**
 * Seeds version 1 of every template. English and Telugu are approved (from the
 * design handoff). Hindi starts as DRAFT, so the demo shows the approval step:
 * until a lab admin approves it, Hindi readers see English summary wording.
 */
const STATUS: Record<TemplateLanguage, "APPROVED" | "DRAFT"> = {
  EN: "APPROVED",
  TE: "APPROVED",
  HI: "DRAFT",
};

export async function upsertDefaultTemplates(db: PrismaClient): Promise<void> {
  for (const language of Object.keys(DEFAULT_TEMPLATES) as TemplateLanguage[]) {
    for (const [key, body] of Object.entries(DEFAULT_TEMPLATES[language])) {
      const existing = await db.summaryTemplate.findUnique({
        where: { key_language_version: { key, language, version: 1 } },
      });
      if (existing) continue;
      const approved = STATUS[language] === "APPROVED";
      await db.summaryTemplate.create({
        data: {
          key,
          language,
          body,
          version: 1,
          status: STATUS[language],
          source: "HUMAN",
          needsDoctorApproval: NEEDS_DOCTOR_APPROVAL.has(key),
          approvedAt: approved ? new Date() : null,
          approvedById: approved ? "seed" : null,
        },
      });
    }
  }
}
