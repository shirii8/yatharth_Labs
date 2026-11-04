import { describe, expect, it } from "vitest";
import { DESK_ROUTES, can } from "./roles";

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

  it("names an action for every desk route, so no route is left unguarded", () => {
    const expected = {
      "/desk/import": ["FRONT_DESK", "LAB_ADMIN"],
      "/desk/patients": ["FRONT_DESK", "LAB_ADMIN"],
      "/desk/calls": ["FRONT_DESK", "LAB_ADMIN"],
      "/desk/wording": ["LAB_ADMIN"],
      "/desk/ai-review": ["LAB_ADMIN"],
    } as const;
    expect(Object.keys(DESK_ROUTES).sort()).toEqual(Object.keys(expected).sort());
    for (const [route, roles] of Object.entries(expected)) {
      const action = DESK_ROUTES[route as keyof typeof DESK_ROUTES];
      expect(can("FRONT_DESK", action), route).toBe(
        (roles as readonly string[]).includes("FRONT_DESK"),
      );
      expect(can("LAB_ADMIN", action), route).toBe(true);
    }
  });
});
