import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Folder } from "@/components/patient/Drawings";
import { Shell } from "@/components/patient/Shell";
import shell from "@/components/patient/shell.module.css";
import { PrimaryButton } from "@/components/ui/Button";
import { checkLink } from "@/lib/auth/link-service";
import { localeFromCookie, messages } from "@/lib/i18n";
import { openLinkAction } from "./actions";

export const metadata: Metadata = {
  title: "A page from your file",
  // Never let a search engine or link preview index a report link.
  robots: { index: false, follow: false },
};

/**
 * The page an SMS link lands on. Opening it does not open the report: a tap
 * does. Message apps fetch links to draw previews, and those fetches must not
 * count as the patient reading their report or start a session.
 */
export default async function LinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await checkLink(token);
  if (link.state === "INVALID") redirect("/notice/invalid");
  if (link.state === "EXPIRED") redirect("/notice/expired");

  const t = messages(localeFromCookie((await cookies()).get("lang")?.value));
  return (
    <Shell>
      <Folder size={110} />
      <h1 className={shell.hero} style={{ fontSize: 44, lineHeight: 1.05 }}>
        {t.link.title}
      </h1>
      <p style={{ margin: 0 }}>{t.link.body}</p>
      <form action={openLinkAction}>
        <input type="hidden" name="token" value={token} />
        <PrimaryButton>{t.link.open}</PrimaryButton>
      </form>
      <p style={{ margin: "auto 0 0", fontSize: "0.85em", color: "var(--ink-soft)" }}>
        {t.link.note}
      </p>
    </Shell>
  );
}
