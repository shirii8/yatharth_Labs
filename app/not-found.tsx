import { cookies } from "next/headers";
import { Notice } from "@/components/patient/Notice";
import { Shell } from "@/components/patient/Shell";
import { localeFromCookie, messages } from "@/lib/i18n";

/**
 * Shown for any page that is not in the patient's file, including a report ID
 * that belongs to another number. It says the same thing either way, so it
 * never confirms that someone else's report exists.
 */
export default async function NotFound() {
  const t = messages(localeFromCookie((await cookies()).get("lang")?.value));
  return (
    <Shell>
      <Notice kind="notFound" t={t} ctaHref="/family" />
    </Shell>
  );
}
