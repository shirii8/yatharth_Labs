import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { OutlineLink, PrimaryButton, PrimaryLink } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import uiStyles from "@/components/ui/ui.module.css";
import { reportForSession } from "@/lib/auth/access";
import { currentSession } from "@/lib/auth/cookies";
import { localeFromCookie, messages } from "@/lib/i18n";
import { FLAG_KINDS, type FlagKind } from "@/lib/patient/requests";
import { raiseFlagAction } from "./actions";

export const metadata: Metadata = { title: "Something looks wrong" };

const TINTS = ["var(--sky)", "var(--sage)", "var(--sand)"];

/**
 * "Something looks wrong", in three steps: what, a little more, thank you.
 * Step 1 is a plain GET form and step 2 a POST, so it works without JavaScript.
 */
export default async function FlagPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string; reportId: string }>;
  searchParams: Promise<{ step?: string; kind?: string; ref?: string; missing?: string }>;
}) {
  const session = await currentSession();
  if (!session || session.kind === "STAFF") redirect("/");
  const { patientId, reportId } = await params;
  const report = await reportForSession(session, reportId);
  if (!report || report.patientId !== patientId) notFound();

  const all = messages(localeFromCookie((await cookies()).get("lang")?.value));
  const t = all.flag;
  const search = await searchParams;
  const kind = FLAG_KINDS.includes(search.kind as FlagKind) ? (search.kind as FlagKind) : null;
  const step = search.ref ? 3 : search.step === "2" && kind ? 2 : 1;
  const base = `/file/${patientId}/${reportId}`;

  return (
    <Shell
      width="narrow"
      back={{ href: base, label: t.cancel }}
      tabs={
        <Tabs
          label={t.stepsLabel}
          items={[1, 2, 3].map((n) => ({
            key: String(n),
            label: n < step ? `✓ ${n}` : String(n),
            current: n === step,
            tint: TINTS[n - 1],
          }))}
        />
      }
    >
      <span className={shell.eyebrow}>{report.test.name}</span>
      {step === 1 ? (
        <form method="get" className={shell.stack} style={{ gap: 18 }}>
          <input type="hidden" name="step" value="2" />
          <fieldset style={{ border: 0, padding: 0, margin: 0 }} className={shell.stack}>
            <legend>
              <h1 className={shell.hero} style={{ fontSize: 42, marginBottom: 8 }}>
                {t.t1}
              </h1>
              <span>{t.s1}</span>
            </legend>
            {search.missing ? (
              <p role="alert" style={{ margin: 0, color: "var(--clay)", fontWeight: 700 }}>
                {t.pickOne}
              </p>
            ) : null}
            {FLAG_KINDS.map((k) => (
              <label
                key={k}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr",
                  gap: 12,
                  alignItems: "center",
                  minHeight: 60,
                  padding: "10px 14px",
                  border: "2px solid var(--ink)",
                  borderRadius: 12,
                  background: "var(--field)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  defaultChecked={k === kind}
                  required
                  style={{ width: 26, height: 26, accentColor: "var(--green)" }}
                />
                <span>{t.opts[k]}</span>
              </label>
            ))}
          </fieldset>
          <PrimaryButton>{all.common.next}</PrimaryButton>
        </form>
      ) : null}

      {step === 2 && kind ? (
        <form action={raiseFlagAction} className={shell.stack} style={{ gap: 18 }}>
          <h1 className={shell.hero} style={{ fontSize: 42 }}>
            {t.t2}
          </h1>
          <p style={{ margin: 0 }}>
            {t.youChose} <strong>{t.opts[kind]}</strong>
          </p>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="reportId" value={reportId} />
          <input type="hidden" name="patientId" value={patientId} />
          <div className={uiStyles.field}>
            <label htmlFor="message" className={uiStyles.label}>
              {t.more}
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              maxLength={1000}
              aria-describedby="message-hint"
              style={{
                padding: 14,
                border: "2.5px solid var(--ink)",
                borderRadius: 12,
                background: "var(--field)",
              }}
            />
            <span id="message-hint" className={uiStyles.helper}>
              {t.optional}
            </span>
          </div>
          <PrimaryButton>{t.send}</PrimaryButton>
          <OutlineLink href={`${base}/flag?kind=${kind}`}>{all.common.back}</OutlineLink>
        </form>
      ) : null}

      {step === 3 ? (
        <>
          <h1 className={shell.hero} style={{ fontSize: 42 }}>
            {t.t3}
          </h1>
          <p style={{ margin: 0 }}>{t.s3}</p>
          <p style={{ margin: 0 }}>
            {t.ref}: <strong style={{ letterSpacing: "0.08em" }}>{search.ref}</strong>
          </p>
          <PrimaryLink href={base}>{t.backReport}</PrimaryLink>
          <p style={{ margin: "auto 0 0", fontFamily: "var(--font-serif)", fontStyle: "italic" }}>
            {t.sign}
          </p>
        </>
      ) : null}
    </Shell>
  );
}
