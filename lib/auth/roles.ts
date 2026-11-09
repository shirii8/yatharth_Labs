/**
 * What each staff role may do. Checked on the server for every desk page and
 * every desk action. Medical wording (templates, translations) and the AI
 * review belong to the lab admin; the front desk runs the day. The lab admin
 * account also stands in for the operations head (assumption A31).
 */

export type StaffRole = "FRONT_DESK" | "LAB_ADMIN" | "DOCTOR";

export type StaffAction =
  | "import"
  | "desk"
  | "resend"
  | "callbacks"
  | "flags"
  | "addFamily"
  | "viewPhone"
  | "approveWording"
  | "reviewAi"
  | "report"
  | "doctorReports";

const FRONT_DESK: StaffAction[] = [
  "import",
  "desk",
  "resend",
  "callbacks",
  "flags",
  "addFamily",
  "viewPhone",
];

const PERMISSIONS: Record<StaffRole, Set<StaffAction>> = {
  FRONT_DESK: new Set(FRONT_DESK),
  LAB_ADMIN: new Set([...FRONT_DESK, "approveWording", "reviewAi", "report"]),
  // A referring doctor sees their own patients' reports and nothing of the desk.
  DOCTOR: new Set(["doctorReports"]),
};

export function can(role: StaffRole, action: StaffAction): boolean {
  return PERMISSIONS[role].has(action);
}

/** Every desk route and the action it needs. A new route must be added here. */
export const DESK_ROUTES = {
  "/desk/import": "import",
  "/desk/patients": "desk",
  "/desk/calls": "callbacks",
  "/desk/wording": "approveWording",
  "/desk/ai-review": "reviewAi",
  "/desk/report": "report",
  "/desk/doctor": "doctorReports",
} as const satisfies Record<string, StaffAction>;

/** Where each role lands after signing in, and after asking for a page it may not open. */
export function homeFor(role: StaffRole): string {
  return role === "DOCTOR" ? "/desk/doctor" : "/desk/patients";
}
