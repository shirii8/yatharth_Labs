import { describe, expect, it } from "vitest";
import { DESK_ROUTES, can, homeFor } from "./roles";

describe("staff roles", () => {
  it("lets the front desk run the day: import, patients, resend, calls, flags, family", () => {
    for (const action of [
      "import",
      "desk",
      "resend",
      "callbacks",
      "flags",
      "addFamily",
      "viewPhone",
    ] as const) {
      expect(can("FRONT_DESK", action), action).toBe(true);
    }
  });

  it("keeps medical wording and the AI review with the lab admin only", () => {
    expect(can("FRONT_DESK", "approveWording")).toBe(false);
    expect(can("FRONT_DESK", "reviewAi")).toBe(false);
    expect(can("LAB_ADMIN", "approveWording")).toBe(true);
    expect(can("LAB_ADMIN", "reviewAi")).toBe(true);
  });

  it("lets the lab admin do everything the front desk can", () => {
    for (const action of [
      "import",
      "desk",
      "resend",
      "callbacks",
      "flags",
      "addFamily",
      "viewPhone",
    ] as const) {
      expect(can("LAB_ADMIN", action), action).toBe(true);
    }
  });

  it("gives the operations report to the lab admin only", () => {
    expect(can("LAB_ADMIN", "report")).toBe(true);
    expect(can("FRONT_DESK", "report")).toBe(false);
    expect(can("DOCTOR", "report")).toBe(false);
  });

  it("lets a referring doctor see their reports and nothing else", () => {
    expect(can("DOCTOR", "doctorReports")).toBe(true);
    for (const action of [
      "import",
      "desk",
      "resend",
      "callbacks",
      "flags",
      "addFamily",
      "viewPhone",
      "approveWording",
      "reviewAi",
    ] as const) {
      expect(can("DOCTOR", action), action).toBe(false);
    }
    // Lab staff do not get the doctor's page: it is built around one doctor's own patients.
    expect(can("FRONT_DESK", "doctorReports")).toBe(false);
    expect(can("LAB_ADMIN", "doctorReports")).toBe(false);
  });

  it("sends each role to a page it may open", () => {
    for (const role of ["FRONT_DESK", "LAB_ADMIN", "DOCTOR"] as const) {
      const home = homeFor(role);
      const action = DESK_ROUTES[home as keyof typeof DESK_ROUTES];
      expect(action, home).toBeDefined();
      expect(can(role, action), role).toBe(true);
    }
  });

  it("names an action for every desk route, so no route is left unguarded", () => {
    const expected = {
      "/desk/import": ["FRONT_DESK", "LAB_ADMIN"],
      "/desk/patients": ["FRONT_DESK", "LAB_ADMIN"],
      "/desk/calls": ["FRONT_DESK", "LAB_ADMIN"],
      "/desk/wording": ["LAB_ADMIN"],
      "/desk/ai-review": ["LAB_ADMIN"],
      "/desk/report": ["LAB_ADMIN"],
      "/desk/doctor": ["DOCTOR"],
    } as const;
    expect(Object.keys(DESK_ROUTES).sort()).toEqual(Object.keys(expected).sort());
    for (const [route, roles] of Object.entries(expected)) {
      const action = DESK_ROUTES[route as keyof typeof DESK_ROUTES];
      for (const role of ["FRONT_DESK", "LAB_ADMIN", "DOCTOR"] as const) {
        expect(can(role, action), `${role} ${route}`).toBe(
          (roles as readonly string[]).includes(role),
        );
      }
    }
  });
});
