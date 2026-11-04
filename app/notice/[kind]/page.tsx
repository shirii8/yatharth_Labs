import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Notice, type NoticeKind } from "@/components/patient/Notice";
import { Shell } from "@/components/patient/Shell";
import { localeFromCookie, messages } from "@/lib/i18n";

export const metadata: Metadata = { title: "A note from the lab" };

const TARGETS: Partial<Record<NoticeKind, string>> = {
  expired: "/",
  invalid: "/",
  timeout: "/",
  empty: "/family",
};

/** Notices reached by redirect: expired or broken links, and a timed-out session. */
export default async function NoticePage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!(kind in TARGETS)) notFound();
  const t = messages(localeFromCookie((await cookies()).get("lang")?.value));
  return (
    <Shell>
      <Notice kind={kind as NoticeKind} t={t} ctaHref={TARGETS[kind as NoticeKind]} />
    </Shell>
  );
}
