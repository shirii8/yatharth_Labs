import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LanguageTabs } from "@/components/patient/LanguageTabs";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { OutlineButton, OutlineLink, TextLink } from "@/components/ui/Button";
import { NotchRule } from "@/components/ui/NotchRule";
import { requirePatient } from "@/lib/auth/guards";
import { localeFromCookie, messages } from "@/lib/i18n";
import { ledgerFor } from "@/lib/patient/ledger";
import { dateTime } from "@/lib/patient-format";
import { signOutAction, withdrawConsentAction } from "../../actions/patient";

export const metadata: Metadata = { title: "Your data and choices" };

/**
 * Your data and choices: the record of every opening, your settings, and
 * withdrawing consent, with what happens listed before the button.
 */
export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<{ withdraw?: string }>;
}) {
  const { household } = await requirePatient();
  const locale = localeFromCookie((await cookies()).get("lang")?.value);
  const t = messages(locale);
  const ledger = await ledgerFor(household.id);
  const { withdraw } = await searchParams;

  return (
    <Shell back={{ href: "/family", label: t.data.back }}>
      <h1 className={shell.hero} style={{ fontSize: 44 }}>
        {t.data.title}
      </h1>
      <p style={{ margin: 0 }}>
        {t.data.number.replace("{phone}", household.phoneMasked)}{" "}
        {household.consentAt
          ? t.data.consentSince.replace("{when}", dateTime(household.consentAt))
          : null}
      </p>

      <div className={shell.split}>
        <div className={shell.col}>
          <section className={shell.stack} aria-labelledby="ledger">
            <h2 id="ledger" className={shell.eyebrow} style={{ margin: 0, fontWeight: 700 }}>
              {t.data.ledgerHead}
            </h2>
            <p style={{ margin: 0, fontSize: "0.85em" }}>{t.data.ledgerNote}</p>
            {ledger.length === 0 ? (
              <p style={{ margin: 0 }}>{t.data.ledgerEmpty}</p>
            ) : (
              <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {ledger.map((row) => (
                  <li
                    key={row.id}
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid var(--rule)",
                      display: "grid",
                      gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 15, color: "var(--ink-soft)" }}>
                      {dateTime(row.at)}
                    </span>
                    <span>
                      {row.byStaff ? <strong>{t.data.staff} </strong> : null}
                      {row.words}
                      {row.about ? `: ${row.about}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        <div className={`${shell.col} ${shell.sticky}`}>
          <section className={shell.stack} aria-labelledby="choices">
            <h2 id="choices" className={shell.eyebrow} style={{ margin: 0, fontWeight: 700 }}>
              {t.data.choicesHead}
            </h2>
            <span>{t.common.language}</span>
            <LanguageTabs current={locale} next="/me/data" />
            <div style={{ height: 8, borderTop: "2.5px solid var(--ink)", marginTop: -2 }} />
            <OutlineLink href="/preference">{t.data.readingStyle}</OutlineLink>
            <form action={signOutAction}>
              <OutlineButton type="submit" style={{ width: "100%" }}>
                {t.common.signOut}
              </OutlineButton>
            </form>
          </section>

          <NotchRule />
          <section className={shell.stack} aria-labelledby="withdraw">
            <h2 id="withdraw" className={shell.eyebrow} style={{ margin: 0, fontWeight: 700 }}>
              {t.data.withdrawHead}
            </h2>
            {withdraw ? (
              <form action={withdrawConsentAction} className={shell.stack}>
                <p style={{ margin: 0 }}>
                  <strong>{t.data.withdrawFirst}</strong>
                </p>
                <ul style={{ margin: 0, paddingLeft: 22 }}>
                  {t.data.consequences.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
                <input type="hidden" name="confirm" value="yes" />
                <OutlineButton
                  type="submit"
                  style={{ borderColor: "var(--clay)", color: "var(--clay)", width: "100%" }}
                >
                  {t.data.withdrawConfirm}
                </OutlineButton>
                <TextLink href="/me/data">{t.data.keep}</TextLink>
              </form>
            ) : (
              <>
                <p style={{ margin: 0 }}>{t.data.withdrawIntro}</p>
                <OutlineLink href="/me/data?withdraw=1#withdraw">
                  {t.data.withdrawStart}
                </OutlineLink>
              </>
            )}
          </section>
        </div>
      </div>
    </Shell>
  );
}
