"use server";

import { redirect } from "next/navigation";
import { homeFor } from "@/lib/auth/roles";
import { z } from "zod";
import { summaryWriter } from "@/lib/ai/provider";
import { clearSessionCookie, ipHash, sessionToken, setSessionCookie } from "@/lib/auth/cookies";
import { revokeSession } from "@/lib/auth/session";
import { requireStaff } from "@/lib/auth/staff-guard";
import { signInStaff } from "@/lib/auth/staff-service";
import { db } from "@/lib/db/client";
import { importLisCsv } from "@/lib/import/service";
import { resendLink } from "@/lib/staff/resend";

/**
 * Every desk action. Each one starts with requireStaff and the action it needs,
 * and validates its input with Zod before touching the database.
 */

// ---------- Sign in and out ----------

export type StaffSignInState = { error?: "WRONG" | "LOCKED" | "INVALID"; until?: string };

const signInForm = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

export async function signInStaffAction(
  _prev: StaffSignInState,
  form: FormData,
): Promise<StaffSignInState> {
  const parsed = signInForm.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "INVALID" };
  const result = await signInStaff({ ...parsed.data, ipHash: await ipHash() });
  if (!result.ok) {
    return result.reason === "LOCKED"
      ? { error: "LOCKED", until: result.until.toISOString() }
      : { error: "WRONG" };
  }
  await setSessionCookie(result.token, result.expiresAt);
  redirect(homeFor(result.role));
}

export async function signOutStaffAction(): Promise<void> {
  const token = await sessionToken();
  if (token) await revokeSession(token);
  await clearSessionCookie();
  redirect("/desk/sign-in");
}

// ---------- Import ----------

export type ImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "done";
      fileName: string;
      totalRows: number;
      importedRows: number;
      updatedRows: number;
      unchangedRows: number;
      errorRows: number;
      linksSent: number;
      criticalTasks: number;
      errors: { rowNumber: number; orderId: string | null; messages: string[] }[];
    };

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export async function importAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const { staff } = await requireStaff("import");
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "Please choose the CSV file exported from the LIS." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { status: "error", message: "That file is larger than 2 MB. Please split the export." };
  }
  if (!/\.csv$/i.test(file.name)) {
    return { status: "error", message: "Please upload a .csv file, as the LIS exports it." };
  }

  const result = await importLisCsv({
    fileName: file.name.slice(0, 200),
    content: await file.text(),
    source: "UPLOAD",
    uploadedById: staff.id,
  });
  if (!result.ok) return { status: "error", message: result.fileError };
  return {
    status: "done",
    fileName: file.name,
    totalRows: result.totalRows,
    importedRows: result.importedRows,
    updatedRows: result.updatedRows,
    unchangedRows: result.unchangedRows,
    errorRows: result.errorRows,
    linksSent: result.linksSent,
    criticalTasks: result.criticalTasks,
    errors: result.errors.map((e) => ({
      rowNumber: e.rowNumber,
      orderId: e.orderId,
      messages: e.messages,
    })),
  };
}

// ---------- Patient desk ----------

const id = z.string().min(1).max(40);

export async function resendAction(form: FormData): Promise<void> {
  const { staff } = await requireStaff("resend");
  const parsed = z.object({ reportId: id, householdId: id }).safeParse({
    reportId: form.get("reportId"),
    householdId: form.get("householdId"),
  });
  if (!parsed.success) redirect("/desk/patients");
  const result = await resendLink(parsed.data.reportId, staff.id);
  const message = result.ok ? "sent" : result.reason === "NO_CONSENT" ? "no-consent" : "not-signed";
  redirect(`/desk/patients/${parsed.data.householdId}?msg=${message}`);
}

const familyForm = z.object({
  householdId: id,
  name: z.string().trim().min(2, "Please type the full name.").max(100),
  age: z.coerce.number().int().min(0, "Age must be 0 to 120.").max(120, "Age must be 0 to 120."),
  sex: z.enum(["FEMALE", "MALE", "OTHER"]),
  relation: z.string().trim().min(2, "Please say how they are related.").max(40),
});

export type FamilyState = { errors?: Record<string, string> };

export async function addFamilyAction(_prev: FamilyState, form: FormData): Promise<FamilyState> {
  await requireStaff("addFamily");
  const parsed = familyForm.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] = issue.message;
    return { errors };
  }
  const { householdId, ...person } = parsed.data;
  const clash = await db.patient.findFirst({ where: { householdId, name: person.name } });
  if (clash) return { errors: { name: "Someone with this name is already on this number." } };
  await db.patient.create({ data: { householdId, ...person } });
  redirect(`/desk/patients/${householdId}?msg=added`);
}

// ---------- Callbacks and flags ----------

const noteForm = z.object({
  id,
  note: z.string().trim().min(2, "Please write what happened on the call.").max(1000),
  back: z.string().max(200).optional(),
});

function safeBack(back: string | undefined, fallback: string) {
  return back && back.startsWith("/desk/") ? back : fallback;
}

export async function doneTaskAction(form: FormData): Promise<void> {
  const { staff } = await requireStaff("callbacks");
  const parsed = noteForm.safeParse({
    id: form.get("id"),
    note: form.get("note"),
    back: form.get("back") ?? undefined,
  });
  const back = safeBack(String(form.get("back") ?? ""), "/desk/calls");
  if (!parsed.success) redirect(`${back}${back.includes("?") ? "&" : "?"}msg=note-needed`);
  await db.callbackTask.updateMany({
    where: { id: parsed.data.id, status: "OPEN" },
    data: { status: "DONE", note: parsed.data.note, doneAt: new Date(), doneById: staff.id },
  });
  redirect(back);
}

export async function resolveFlagAction(form: FormData): Promise<void> {
  const { staff } = await requireStaff("flags");
  const parsed = noteForm.safeParse({
    id: form.get("id"),
    note: form.get("note"),
    back: form.get("back") ?? undefined,
  });
  const back = safeBack(String(form.get("back") ?? ""), "/desk/calls");
  if (!parsed.success) redirect(`${back}${back.includes("?") ? "&" : "?"}msg=note-needed`);
  await db.patientFlag.updateMany({
    where: { id: parsed.data.id, status: "OPEN" },
    data: {
      status: "RESOLVED",
      resolution: parsed.data.note,
      resolvedAt: new Date(),
      resolvedById: staff.id,
    },
  });
  redirect(back);
}

// ---------- Wording (lab admin) ----------

export async function approveTemplateAction(form: FormData): Promise<void> {
  const { staff } = await requireStaff("approveWording");
  const parsed = id.safeParse(form.get("id"));
  if (!parsed.success) redirect("/desk/wording");
  const draft = await db.summaryTemplate.findUnique({ where: { id: parsed.data } });
  if (!draft || draft.status !== "DRAFT") redirect("/desk/wording");
  await db.$transaction([
    // The previous approved wording for this key and language is retired, never deleted.
    db.summaryTemplate.updateMany({
      where: { key: draft.key, language: draft.language, status: "APPROVED" },
      data: { status: "RETIRED" },
    }),
    db.summaryTemplate.update({
      where: { id: draft.id },
      data: { status: "APPROVED", approvedById: staff.id, approvedAt: new Date() },
    }),
  ]);
  redirect("/desk/wording?msg=approved");
}

export async function rejectTemplateAction(form: FormData): Promise<void> {
  await requireStaff("approveWording");
  const parsed = z
    .object({ id, reason: z.string().trim().min(2).max(500) })
    .safeParse({ id: form.get("id"), reason: form.get("reason") });
  if (!parsed.success) redirect("/desk/wording?msg=reason-needed");
  await db.summaryTemplate.updateMany({
    where: { id: parsed.data.id, status: "DRAFT" },
    data: { status: "REJECTED", rejectedReason: parsed.data.reason },
  });
  redirect("/desk/wording?msg=rejected");
}

/**
 * Asks the AI to translate every approved English template that has no
 * Telugu or Hindi wording yet. Results are stored as DRAFT, source AI, and are
 * never shown to patients until a lab admin approves them.
 */
export async function draftTranslationsAction(form: FormData): Promise<void> {
  await requireStaff("approveWording");
  const language = z.enum(["TE", "HI"]).safeParse(form.get("language"));
  if (!language.success) redirect("/desk/wording");
  const writer = summaryWriter();
  if (!writer) redirect("/desk/wording?msg=no-ai");

  const english = await db.summaryTemplate.findMany({
    where: { language: "EN", status: "APPROVED" },
  });
  const existing = new Set(
    (
      await db.summaryTemplate.findMany({
        where: { language: language.data, status: { in: ["APPROVED", "DRAFT"] } },
        select: { key: true },
      })
    ).map((r) => r.key),
  );
  const missing = english.filter((t) => !existing.has(t.key)).slice(0, 12);
  let made = 0;
  for (const template of missing) {
    try {
      const body = (await writer.translate(template.body, language.data)).trim();
      // Placeholders must survive translation exactly, or the rules cannot fill them.
      const want = (template.body.match(/\{\w+\}/g) ?? []).sort().join();
      const got = (body.match(/\{\w+\}/g) ?? []).sort().join();
      if (!body || want !== got) continue;
      const latest = await db.summaryTemplate.findFirst({
        where: { key: template.key, language: language.data },
        orderBy: { version: "desc" },
      });
      await db.summaryTemplate.create({
        data: {
          key: template.key,
          language: language.data,
          body,
          version: (latest?.version ?? 0) + 1,
          status: "DRAFT",
          source: "AI",
          sourceTemplateId: template.id,
          needsDoctorApproval: template.needsDoctorApproval,
        },
      });
      made += 1;
    } catch {
      // One failed translation leaves that key in English; the rest carry on.
    }
  }
  redirect(`/desk/wording?msg=drafted-${made}`);
}

// ---------- AI review (lab admin) ----------

export async function reviewAiAction(form: FormData): Promise<void> {
  const { staff } = await requireStaff("reviewAi");
  const parsed = z
    .object({
      id,
      verdict: z.enum(["GOOD", "NEEDS_CHANGE", "WRONG"]),
      note: z.string().trim().max(1000).optional(),
    })
    .safeParse({
      id: form.get("id"),
      verdict: form.get("verdict"),
      note: form.get("note") || undefined,
    });
  if (!parsed.success) redirect("/desk/ai-review");
  await db.aiSummary.update({
    where: { id: parsed.data.id },
    data: {
      verdict: parsed.data.verdict,
      reviewNote: parsed.data.note,
      reviewedAt: new Date(),
      reviewedById: staff.id,
      // A summary the pathologist marks wrong stops showing at once; the rule wording returns.
      ...(parsed.data.verdict === "WRONG" ? { status: "REJECTED" as const } : {}),
    },
  });
  redirect("/desk/ai-review?msg=saved");
}
