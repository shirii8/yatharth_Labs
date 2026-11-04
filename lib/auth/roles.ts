/**
 * What each staff role may do. Checked on the server for every desk page and
 * every desk action. Medical wording (templates, translations) and the AI
 * review belong to the lab admin; the front desk runs the day.
 */

export type StaffRole = "FRONT_DESK" | "LAB_ADMIN";

export type StaffAction =
  | "import"
  | "desk"
  | "resend"
  | "callbacks"
  | "flags"
  | "addFamily"
  | "viewPhone"
  | "approveWording"
  | "reviewAi";

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
  LAB_ADMIN: new Set([...FRONT_DESK, "approveWording", "reviewAi"]),
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
} as const satisfies Record<string, StaffAction>;
