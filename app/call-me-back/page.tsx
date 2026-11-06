import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Phone } from "@/components/patient/Drawings";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { PrimaryButton, PrimaryLink, TextLink } from "@/components/ui/Button";
import uiStyles from "@/components/ui/ui.module.css";
import { currentSession } from "@/lib/auth/cookies";
import { db } from "@/lib/db/client";
import { localeFromCookie, messages } from "@/lib/i18n";
import { callBackAction } from "./actions";

export const metadata: Metadata = { title: "Call me back" };

/**
 * "Call me back" from any patient screen. Signed in, it creates a task for the
 * front desk. Signed out, we cannot know whose file it is, so it says so and
 * offers the phone instead of promising a call we could not make.
 */
export default async function CallMeBackPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; report?: string }>;
}) {
  const t = messages(localeFromCookie((await cookies()).get("lang")?.value));
  const session = await currentSession();
  const { done, report } = await searchParams;
  const labPhone = process.env.NEXT_PUBLIC_LAB_PHONE || "+910000000000";

  if (!session?.householdId || session.kind === "STAFF") {
    return (
      <Shell width="narrow">
        <Phone size={100} />
        <h1 className={shell.hero} style={{ fontSize: 42 }}>
          {t.callBack.signedOutTitle}
        </h1>
        <p style={{ margin: 0 }}>{t.callBack.signedOutBody}</p>
        <PrimaryLink href="/">{t.callBack.signIn}</PrimaryLink>
        <a className={uiStyles.outline} href={`tel:${labPhone}`}>
          {t.common.callLab}
        </a>
      </Shell>
    );
  }

  const household = await db.household.findUniqueOrThrow({ where: { id: session.householdId } });
  const back =
    session.kind === "LINK" && session.patientId && session.reportId
      ? `/file/${session.patientId}/${session.reportId}`
      : "/family";

  if (done) {
    return (
      <Shell width="narrow">
        <Phone size={100} />
        <h1 className={shell.hero} style={{ fontSize: 42 }}>
          {t.callBack.doneTitle}
        </h1>
        <p style={{ margin: 0 }}>{t.callBack.doneBody.replace("{phone}", household.phoneMasked)}</p>
        <TextLink href={back}>{t.callBack.back}</TextLink>
      </Shell>
    );
  }

  return (
    <Shell width="narrow">
      <Phone size={100} />
      <h1 className={shell.hero} style={{ fontSize: 42 }}>
        {t.callBack.title}
      </h1>
      <p style={{ margin: 0 }}>{t.callBack.body.replace("{phone}", household.phoneMasked)}</p>
      <form action={callBackAction} className={shell.stack} style={{ gap: 18 }}>
        <input type="hidden" name="reportId" value={report ?? session.reportId ?? ""} />
        <div className={uiStyles.field}>
          <label htmlFor="reason" className={uiStyles.label}>
            {t.callBack.reasonLabel}
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={3}
            maxLength={500}
            aria-describedby="reason-hint"
            style={{
              padding: 14,
              border: "2.5px solid var(--ink)",
              borderRadius: 12,
              background: "var(--field)",
            }}
          />
          <span id="reason-hint" className={uiStyles.helper}>
            {t.callBack.reasonHint}
          </span>
        </div>
        <PrimaryButton>{t.callBack.send}</PrimaryButton>
      </form>
      <TextLink href={back}>{t.callBack.back}</TextLink>
    </Shell>
  );
}
