import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { currentSession } from "./cookies";
import { can, type StaffAction } from "./roles";

/**
 * Every desk page and desk action starts here. No staff session: sign in. A
 * patient or link session never passes. A role without the action: back to
 * the desk with a message, never the page.
 */
export async function requireStaff(action: StaffAction) {
  const session = await currentSession();
  if (!session || session.kind !== "STAFF" || !session.staffUserId) redirect("/desk/sign-in");
  const staff = await db.staffUser.findUnique({ where: { id: session.staffUserId } });
  if (!staff || !staff.active) redirect("/desk/sign-in");
  if (!can(staff.role, action)) redirect("/desk/patients?denied=1");
  return { session, staff };
}
