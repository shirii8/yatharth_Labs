import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { hasConsent } from "./access";
import { currentSession, sessionToken } from "./cookies";

/**
 * Page guards for patient screens. Each one sends the patient somewhere kind
 * (sign in, the timeout notice, consent) instead of showing an error.
 */

/** A signed-in patient (full sign-in, not a link) and their household. */
export async function requirePatient() {
  const session = await currentSession();
  // A cookie that no longer works means the session timed out.
  if (!session) redirect((await sessionToken()) ? "/notice/timeout" : "/");
  // A link opens one page only; the whole file needs a sign-in with a code.
  if (session.kind !== "PATIENT" || !session.householdId) redirect("/");
  const household = await db.household.findUniqueOrThrow({ where: { id: session.householdId } });
  return { session, household };
}

/** As above, and consent given: every page that shows reports uses this. */
export async function requireConsentedPatient() {
  const found = await requirePatient();
  if (!hasConsent(found.household)) redirect("/consent");
  return found;
}
