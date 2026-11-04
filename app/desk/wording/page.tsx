import type { Metadata } from "next";
import { DeskShell } from "@/components/staff/DeskShell";
import { requireStaff } from "@/lib/auth/staff-guard";
import { db } from "@/lib/db/client";
import { approveTemplateAction, draftTranslationsAction, rejectTemplateAction } from "../actions";
import styles from "../desk.module.css";

export const metadata: Metadata = { title: "Wording approvals" };

const LANG = { EN: "English", TE: "Telugu", HI: "Hindi" } as const;

const MESSAGES: Record<string, string> = {
  approved: "Approved. Patients reading that language now see this wording.",
  rejected: "Rejected. Patients keep seeing the approved wording, or English.",
  "reason-needed": "Please give a short reason when rejecting.",
  "no-ai": "AI is not set up (no ANTHROPIC_API_KEY), so no drafts were made.",
};

/**
 * Lab admin only. Draft wording, written by a person or translated by the AI,
 * waits here. Nothing reaches a patient until it is approved; until then the
 * patient sees the approved English.
 */
export default async function WordingPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const { staff } = await requireStaff("approveWording");
  const { msg } = await searchParams;
  const drafts = await db.summaryTemplate.findMany({
    where: { status: "DRAFT" },
    orderBy: [{ language: "asc" }, { key: "asc" }],
  });
  const english = new Map(
    (await db.summaryTemplate.findMany({ where: { language: "EN", status: "APPROVED" } })).map(
      (t) => [t.key, t.body],
    ),
  );
  const pending = await db.summaryTemplate.findMany({
    where: { status: "APPROVED", needsDoctorApproval: true },
  });
  const message =
    msg && MESSAGES[msg]
      ? MESSAGES[msg]
      : msg?.startsWith("drafted-")
        ? `${msg.slice(8)} AI drafts made. Read each one before approving.`
        : null;

  return (
    <DeskShell staff={staff} current="/desk/wording">
      <h1 className={styles.title}>Wording approvals</h1>
      <p className={styles.muted} style={{ marginTop: 0 }}>
        Every sentence a patient reads about results comes from approved wording. Drafts, including
        AI translations, wait here until you approve them.
      </p>
      {message ? (
        <p className={styles.notice} role="status">
          {message}
        </p>
      ) : null}

      <div className={styles.actions} style={{ marginBottom: 12 }}>
        {(["TE", "HI"] as const).map((language) => (
          <form key={language} action={draftTranslationsAction}>
            <input type="hidden" name="language" value={language} />
            <button type="submit" className={styles.btn}>
              Draft missing {LANG[language]} with AI
            </button>
          </form>
        ))}
      </div>

      <h2 className={styles.h2}>Waiting for approval ({drafts.length})</h2>
      {drafts.length === 0 ? <p className={styles.muted}>No drafts waiting.</p> : null}
      {drafts.map((d) => (
        <div key={d.id} className={styles.card}>
          <span className={styles.kicker}>
            {LANG[d.language]} · {d.key} · version {d.version} ·{" "}
            {d.source === "AI" ? "translated by AI" : "written by a person"}
          </span>
          <span lang={d.language.toLowerCase()} style={{ fontSize: 19 }}>
            {d.body}
          </span>
          {english.get(d.key) ? (
            <span className={styles.muted}>English: {english.get(d.key)}</span>
          ) : null}
          <div className={styles.actions}>
            <form action={approveTemplateAction}>
              <input type="hidden" name="id" value={d.id} />
              <button type="submit" className={styles.btnPrimary}>
                Approve
              </button>
            </form>
            <form action={rejectTemplateAction} className={styles.actions}>
              <input type="hidden" name="id" value={d.id} />
              <label htmlFor={`r-${d.id}`} className="visually-hidden">
                Reason
              </label>
              <input
                id={`r-${d.id}`}
                name="reason"
                className={styles.input}
                placeholder="Reason"
                required
              />
              <button type="submit" className={styles.btn}>
                Reject
              </button>
            </form>
          </div>
        </div>
      ))}

      <h2 className={styles.h2}>Needs the lab doctor before go-live ({pending.length})</h2>
      <p className={styles.muted} style={{ marginTop: -6 }}>
        Placeholder safety wording, shown on &ldquo;Please call us&rdquo; pages with a note that it
        awaits approval.
      </p>
      <ul>
        {pending.map((p) => (
          <li key={p.id}>
            {LANG[p.language]} · {p.key}: {p.body}
          </li>
        ))}
      </ul>
    </DeskShell>
  );
}
